"""Auth endpoint tests: login/refresh/protected routes."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio


async def test_login_success(async_client, test_user):
    resp = await async_client.post(
        "/api/auth/login",
        json={"email": test_user.email, "password": "test-password-123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


async def test_login_wrong_password(async_client, test_user):
    resp = await async_client.post(
        "/api/auth/login",
        json={"email": test_user.email, "password": "wrong-password"},
    )
    assert resp.status_code == 401


async def test_login_unknown_user(async_client, test_user):
    resp = await async_client.post(
        "/api/auth/login",
        json={"email": "nobody-at-all@example.com", "password": "password"},
    )
    assert resp.status_code == 401


async def test_refresh_token(async_client, test_user):
    login = await async_client.post(
        "/api/auth/login",
        json={"email": test_user.email, "password": "test-password-123"},
    )
    refresh_token = login.json()["refresh_token"]
    resp = await async_client.post(
        "/api/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


async def test_refresh_with_access_token_rejected(async_client, test_user):
    """Access tokens must not be accepted as refresh tokens."""
    login = await async_client.post(
        "/api/auth/login",
        json={"email": test_user.email, "password": "test-password-123"},
    )
    access_token = login.json()["access_token"]
    resp = await async_client.post(
        "/api/auth/refresh",
        json={"refresh_token": access_token},
    )
    assert resp.status_code == 401


async def test_protected_endpoint_requires_auth(async_client, test_user):
    resp = await async_client.get("/api/v1/settings")
    assert resp.status_code == 401


async def test_api_key_auth(async_client, test_user):
    resp = await async_client.get(
        "/api/agent/summary/today",
        headers={"X-API-Key": test_user.plain_api_key},
    )
    assert resp.status_code == 200


async def test_api_key_wrong_key_rejected(async_client, test_user):
    resp = await async_client.get(
        "/api/agent/summary/today",
        headers={"X-API-Key": "completely-wrong-key"},
    )
    assert resp.status_code == 401


async def test_agent_endpoint_accepts_jwt(async_client, auth_headers):
    """/api/agent/* must also accept a JWT Bearer token, not just X-API-Key."""
    resp = await async_client.get("/api/agent/summary/today", headers=auth_headers)
    assert resp.status_code == 200


async def test_foods_create_accepts_jwt(async_client, auth_headers):
    """/api/foods/* must also accept a JWT Bearer token, not just X-API-Key."""
    resp = await async_client.post(
        "/api/foods",
        json={
            "name": "JWT Auth Test Food",
            "source": "manual",
            "nutrients": {"kcal": 100, "protein": 10.0},
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201


async def test_jwt_or_api_key_wrong_api_key_still_401(async_client, test_user):
    """Wrong X-API-Key on the combined dependency must still be rejected."""
    resp = await async_client.post(
        "/api/foods",
        json={"name": "Should Not Be Created", "source": "manual", "nutrients": {"kcal": 100}},
        headers={"X-API-Key": "completely-wrong-key"},
    )
    assert resp.status_code == 401


# --- Refresh token rotation and revocation ---


async def _login(async_client, test_user):
    from tests.conftest import TEST_PASSWORD

    resp = await async_client.post(
        "/api/auth/login", json={"email": test_user.email, "password": TEST_PASSWORD}
    )
    assert resp.status_code == 200
    return resp.json()


async def test_refresh_rotates_and_old_token_is_single_use(async_client, test_user):
    first = (await _login(async_client, test_user))["refresh_token"]
    resp = await async_client.post("/api/auth/refresh", json={"refresh_token": first})
    assert resp.status_code == 200
    second = resp.json()["refresh_token"]
    assert second and second != first

    # The rotated-in token works once...
    replay = await async_client.post("/api/auth/refresh", json={"refresh_token": first})
    assert replay.status_code == 401
    # ...and replaying the old one is treated as theft: the whole chain is revoked.
    assert (await async_client.post("/api/auth/refresh", json={"refresh_token": second})).status_code == 401


async def test_logout_revokes_refresh_token(async_client, test_user):
    token = (await _login(async_client, test_user))["refresh_token"]
    resp = await async_client.post("/api/auth/logout", json={"refresh_token": token})
    assert resp.status_code == 204
    assert (await async_client.post("/api/auth/refresh", json={"refresh_token": token})).status_code == 401


async def test_logout_all_sessions(async_client, test_user):
    a = (await _login(async_client, test_user))["refresh_token"]
    b = (await _login(async_client, test_user))["refresh_token"]
    await async_client.post("/api/auth/logout", json={"refresh_token": a, "all_sessions": True})
    assert (await async_client.post("/api/auth/refresh", json={"refresh_token": b})).status_code == 401


async def test_refresh_token_without_jti_is_refused(async_client, test_user):
    """Tokens minted before refresh tokens became revocable carry no jti."""
    from datetime import UTC, datetime, timedelta

    import jwt as pyjwt

    from app.config import settings

    legacy = pyjwt.encode(
        {"sub": str(test_user.id), "exp": datetime.now(UTC) + timedelta(days=1), "type": "refresh"},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    assert (await async_client.post("/api/auth/refresh", json={"refresh_token": legacy})).status_code == 401


async def test_api_key_is_stored_hashed_and_regenerate_shows_it_once(async_client, auth_headers, test_user, db_session):
    from app.auth.api_keys import hash_api_key

    await db_session.refresh(test_user)
    assert test_user.api_key_hash == hash_api_key(test_user.plain_api_key)
    assert test_user.plain_api_key not in (test_user.api_key_hash, test_user.api_key_prefix)

    resp = await async_client.post("/api/v1/settings/regenerate-api-key", headers=auth_headers)
    assert resp.status_code == 200
    new_key = resp.json()["api_key"]
    await db_session.refresh(test_user)
    assert test_user.api_key_hash == hash_api_key(new_key)
    assert new_key not in test_user.api_key_hash
    assert (await async_client.get("/api/agent/summary/today", headers={"X-API-Key": new_key})).status_code == 200
    assert (
        await async_client.get("/api/agent/summary/today", headers={"X-API-Key": test_user.plain_api_key})
    ).status_code == 401
    settings = await async_client.get("/api/v1/settings", headers=auth_headers)
    assert settings.json()["api_key_masked"] == new_key[:8] + "..."
