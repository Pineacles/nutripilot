"""Withings reconnect: login link, callback, and what a bad or foreign state cannot do."""

from __future__ import annotations

from urllib.parse import parse_qs, urlparse
from uuid import UUID

import pytest
from sqlalchemy import select

from app.models.integration import Integration
from app.routers.agent import withings_oauth

pytestmark = pytest.mark.asyncio

_PAYLOAD = {
    "name": "Withings Body+",
    "source_url": "https://wbsapi.withings.net/measure",
    "auth_header": "old-access-token",
    "schedule": "0 6 * * *",
    "field_mapping": {
        "type": "withings_measure",
        "source_label": "withings",
        "data_type": "weight",
        "measure_map": {"1": "weight_kg"},
        "refresh_token": "dead-refresh-token",
        "client_id": "my-client-id",
        "client_secret": "my-client-secret",
    },
}


@pytest.fixture(autouse=True)
def public_address(monkeypatch):
    monkeypatch.setattr(withings_oauth.settings, "public_url", "https://np.example.com")


async def _broken_integration(async_client, headers, db_session) -> str:
    resp = await async_client.post("/api/agent/integrations", json=_PAYLOAD, headers=headers)
    assert resp.status_code == 201
    iid = resp.json()["id"]
    row = (await db_session.execute(select(Integration).where(Integration.id == UUID(iid)))).scalar_one()
    row.status = "needs_reauth"
    await db_session.commit()
    return iid


async def _state_for(async_client, headers, iid) -> str:
    resp = await async_client.post(f"/api/agent/integrations/{iid}/reconnect", headers=headers)
    assert resp.status_code == 200
    url = urlparse(resp.json()["url"])
    q = parse_qs(url.query)
    assert url.netloc == "account.withings.com"
    assert q["client_id"] == ["my-client-id"]
    assert q["redirect_uri"] == ["https://np.example.com/api/agent/oauth/withings/callback"]
    return q["state"][0]


async def test_reconnect_saves_new_tokens_and_reactivates(async_client, auth_headers, db_session, monkeypatch):
    iid = await _broken_integration(async_client, auth_headers, db_session)
    state = await _state_for(async_client, auth_headers, iid)
    seen = {}

    async def fake_exchange(code, client_id, client_secret):
        seen.update(code=code, client_id=client_id, client_secret=client_secret)
        return {"access_token": "new-access", "refresh_token": "new-refresh", "expires_in": 10800}

    monkeypatch.setattr(withings_oauth, "exchange_code", fake_exchange)
    resp = await async_client.get("/api/agent/oauth/withings/callback", params={"code": "abc", "state": state})
    assert resp.status_code == 303
    assert resp.headers["location"] == "https://np.example.com/settings/connections?withings=connected"
    assert seen == {"code": "abc", "client_id": "my-client-id", "client_secret": "my-client-secret"}

    db_session.expire_all()
    row = (await db_session.execute(select(Integration).where(Integration.id == UUID(iid)))).scalar_one()
    assert row.status == "active"
    assert row.auth_header == "new-access"
    assert row.field_mapping["refresh_token"] == "new-refresh"


async def test_forged_or_missing_state_changes_nothing(async_client, auth_headers, db_session, monkeypatch):
    iid = await _broken_integration(async_client, auth_headers, db_session)

    async def must_not_run(*_):
        raise AssertionError("token exchange without a valid state")

    monkeypatch.setattr(withings_oauth, "exchange_code", must_not_run)
    for params in ({"code": "abc"}, {"code": "abc", "state": "not-a-token"}):
        resp = await async_client.get("/api/agent/oauth/withings/callback", params=params)
        assert resp.headers["location"].endswith("?withings=expired")
    row = (await db_session.execute(select(Integration).where(Integration.id == UUID(iid)))).scalar_one()
    assert row.status == "needs_reauth"


async def test_a_login_token_is_not_a_state(async_client, auth_headers, db_session):
    iid = await _broken_integration(async_client, auth_headers, db_session)
    login_token = auth_headers["Authorization"].removeprefix("Bearer ")
    resp = await async_client.get("/api/agent/oauth/withings/callback", params={"code": "abc", "state": login_token})
    assert resp.headers["location"].endswith("?withings=expired")
    assert withings_oauth.read_state(login_token) is None
    row = (await db_session.execute(select(Integration).where(Integration.id == UUID(iid)))).scalar_one()
    assert row.status == "needs_reauth"


async def test_a_state_works_once_and_a_newer_one_replaces_it(async_client, auth_headers, db_session, monkeypatch):
    iid = await _broken_integration(async_client, auth_headers, db_session)
    first = await _state_for(async_client, auth_headers, iid)
    second = await _state_for(async_client, auth_headers, iid)

    async def fake_exchange(*_):
        return {"access_token": "a", "refresh_token": "r", "expires_in": 10800}

    monkeypatch.setattr(withings_oauth, "exchange_code", fake_exchange)
    cb = "/api/agent/oauth/withings/callback"
    assert (await async_client.get(cb, params={"code": "x", "state": first})).headers["location"].endswith("=expired")
    assert (await async_client.get(cb, params={"code": "x", "state": second})).headers["location"].endswith("=connected")
    assert (await async_client.get(cb, params={"code": "x", "state": second})).headers["location"].endswith("=expired")


async def test_nonce_is_never_shown(async_client, auth_headers, db_session):
    iid = await _broken_integration(async_client, auth_headers, db_session)
    await _state_for(async_client, auth_headers, iid)
    listed = (await async_client.get("/api/agent/integrations", headers=auth_headers)).json()
    fm = next(i for i in listed if i["id"] == iid)["field_mapping"]
    assert fm["reconnect_nonce"] == "•••"


async def test_odd_withings_answers_are_a_failed_login(monkeypatch):
    class Resp:
        def __init__(self, body):
            self.body = body

        def json(self):
            return self.body

    for body in ([], {"status": 0, "body": []}, {"status": 0, "body": {"access_token": "a"}},
                 {"status": 503, "body": {}}):
        class Client:
            def __init__(self, *_, **__):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *_):
                return False

            async def post(self, *_, _body=body, **__):
                return Resp(_body)

        monkeypatch.setattr(withings_oauth.httpx, "AsyncClient", Client)
        assert await withings_oauth.exchange_code("c", "id", "secret") is None


async def test_user_declining_on_withings_is_cancelled(async_client, auth_headers, db_session):
    iid = await _broken_integration(async_client, auth_headers, db_session)
    state = await _state_for(async_client, auth_headers, iid)
    resp = await async_client.get("/api/agent/oauth/withings/callback", params={"state": state, "error": "access_denied"})
    assert resp.headers["location"].endswith("?withings=cancelled")


async def test_failed_exchange_keeps_needs_reauth(async_client, auth_headers, db_session, monkeypatch):
    iid = await _broken_integration(async_client, auth_headers, db_session)
    state = await _state_for(async_client, auth_headers, iid)

    async def refused(*_):
        return None

    monkeypatch.setattr(withings_oauth, "exchange_code", refused)
    resp = await async_client.get("/api/agent/oauth/withings/callback", params={"code": "abc", "state": state})
    assert resp.headers["location"].endswith("?withings=failed")
    row = (await db_session.execute(select(Integration).where(Integration.id == UUID(iid)))).scalar_one()
    assert row.status == "needs_reauth"


async def test_another_user_cannot_start_a_reconnect(async_client, auth_headers, db_session):
    import uuid

    from app.auth.api_keys import api_key_fields
    from app.models.user import User

    iid = await _broken_integration(async_client, auth_headers, db_session)
    key = f"other-{uuid.uuid4().hex}"
    db_session.add(User(id=uuid.uuid4(), email=f"o-{uuid.uuid4().hex[:8]}@x.dev", password_hash="x", **api_key_fields(key)))
    await db_session.commit()
    resp = await async_client.post(f"/api/agent/integrations/{iid}/reconnect", headers={"X-API-Key": key})
    assert resp.status_code == 404


async def test_only_withings_reconnects(async_client, auth_headers):
    body = {**_PAYLOAD, "name": "Generic", "field_mapping": {
        "type": "generic_json", "source_label": "x", "data_type": "weight", "measure_map": {"weight": "weight_kg"}}}
    resp = await async_client.post("/api/agent/integrations", json=body, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    r = await async_client.post(f"/api/agent/integrations/{resp.json()['id']}/reconnect", headers=auth_headers)
    assert r.status_code == 422
