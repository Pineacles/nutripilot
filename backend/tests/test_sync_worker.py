"""Service-layer tests for app.services.sync_worker.

Previously zero coverage. These tests call the worker's functions directly
with a db session (per the redesign brief) rather than going through HTTP —
httpx calls to the *vendor* APIs (Withings, generic OAuth2, generic JSON) are
mocked with respx; the SSRF guard's DNS resolution is real (it targets
loopback/private addresses, which resolve locally without network access).

``patch_sync_worker_db`` (see conftest.py) is required by every test that
calls ``sync_integration`` / ``run_all_syncs`` / ``_ensure_valid_token``,
because those functions open their own session via
``app.database.async_session`` — a different engine instance than the
fixtures' ``db_session`` — and need to be pointed at the same in-memory DB.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta

import httpx
import pytest
import pytest_asyncio
import respx
from sqlalchemy import select, text

from app.models.integration import Integration
from app.models.weight_log import WeightLog
from app.services import sync_worker
from app.services.integration_logger import SyncLogger
from app.services.logging_service import upsert_weight

pytestmark = pytest.mark.asyncio


class _FakeIntegration:
    """Minimal stand-in with just the attributes SyncLogger reads."""

    def __init__(self, user_id):
        self.field_mapping: dict = {}
        self.user_id = user_id
        self.id = uuid.uuid4()


async def _make_integration(db_session, user_id, **overrides) -> Integration:
    defaults = dict(
        id=uuid.uuid4(),
        user_id=user_id,
        name="Test Integration",
        source_url="https://wbsapi.withings.net/measure",
        auth_header="initial-access-token",
        schedule="0 6 * * *",
        field_mapping={
            "type": "withings_measure",
            "source_label": "withings",
            "data_type": "weight",
            "measure_map": {"1": "weight_kg"},
        },
        status="active",
    )
    defaults.update(overrides)
    integration = Integration(**defaults)
    db_session.add(integration)
    await db_session.commit()
    await db_session.refresh(integration)
    return integration


@pytest_asyncio.fixture(autouse=True)
async def _no_real_sleep(monkeypatch):
    """Every backoff sleep in these tests is patched to a no-op.

    Without this, the transient-retry test would burn real wall-clock time
    (2s + 8s of backoff — see BACKOFF_BASE_SECONDS/MAX_REFRESH_ATTEMPTS).
    """
    async def _fast_sleep(_seconds):
        return None

    monkeypatch.setattr(sync_worker.asyncio, "sleep", _fast_sleep)


# ===========================================================================
# Token refresh error classification
# ===========================================================================


@respx.mock
async def test_oauth2_refresh_401_invalid_grant_is_permanent():
    """RFC 6749 'invalid_grant' at HTTP 401 -> permanent (matches _OAUTH2_PERMANENT_ERRORS)."""
    respx.post("https://api.fitbit.com/oauth2/token").mock(
        return_value=httpx.Response(401, json={"error": "invalid_grant"})
    )
    result = await sync_worker._refresh_oauth2_token(
        "refresh-tok", "client-id", "client-secret", {"type": "fitbit_body"}
    )
    assert result.permanent is True
    assert result.ok is False
    assert result.http_status == 401


@respx.mock
async def test_oauth2_refresh_500_is_transient():
    respx.post("https://api.fitbit.com/oauth2/token").mock(return_value=httpx.Response(500))
    result = await sync_worker._refresh_oauth2_token(
        "refresh-tok", "client-id", "client-secret", {"type": "fitbit_body"}
    )
    assert result.permanent is False
    assert result.ok is False
    assert result.http_status == 500


@respx.mock
async def test_oauth2_refresh_timeout_is_transient():
    respx.post("https://api.fitbit.com/oauth2/token").mock(side_effect=httpx.TimeoutException("timed out"))
    result = await sync_worker._refresh_oauth2_token(
        "refresh-tok", "client-id", "client-secret", {"type": "fitbit_body"}
    )
    assert result.permanent is False
    assert result.ok is False
    assert "timed out" in result.error.lower()


@respx.mock
async def test_oauth2_refresh_expired_token_error_type_is_transient():
    """Fitbit-specific nuance: HTTP 401 with error_type=expired_token is NOT permanent."""
    respx.post("https://api.fitbit.com/oauth2/token").mock(
        return_value=httpx.Response(401, json={"error": "invalid_token", "error_type": "expired_token"})
    )
    result = await sync_worker._refresh_oauth2_token(
        "refresh-tok", "client-id", "client-secret", {"type": "fitbit_body"}
    )
    assert result.permanent is False


@respx.mock
async def test_withings_refresh_status_in_body_permanent():
    """Withings ALWAYS returns HTTP 200 — errors live in the JSON 'status' field."""
    respx.post("https://wbsapi.withings.net/v2/oauth2").mock(
        return_value=httpx.Response(200, json={"status": 401, "error": "expired token"})
    )
    result = await sync_worker._refresh_withings_token("refresh-tok", "cid", "secret", {})
    assert result.http_status is None  # HTTP itself was 200; classification comes from body
    assert result.permanent is True
    assert result.provider_code == 401


@respx.mock
async def test_withings_refresh_status_in_body_transient():
    respx.post("https://wbsapi.withings.net/v2/oauth2").mock(
        return_value=httpx.Response(200, json={"status": 601, "error": "too many requests"})
    )
    result = await sync_worker._refresh_withings_token("refresh-tok", "cid", "secret", {})
    assert result.permanent is False
    assert result.provider_code == 601


@respx.mock
async def test_withings_refresh_status_zero_is_success():
    respx.post("https://wbsapi.withings.net/v2/oauth2").mock(
        return_value=httpx.Response(
            200,
            json={"status": 0, "body": {"access_token": "new-tok", "refresh_token": "new-refresh", "expires_in": 10800}},
        )
    )
    result = await sync_worker._refresh_withings_token("refresh-tok", "cid", "secret", {})
    assert result.ok is True
    assert result.tokens["access_token"] == "new-tok"


# ===========================================================================
# _ensure_valid_token: retry/backoff + terminal states
# ===========================================================================


@respx.mock
async def test_ensure_valid_token_retries_transient_then_marks_error(db_session, test_user, patch_sync_worker_db):
    """3 consecutive transient failures -> status 'error' (NOT needs_reauth), so a later sync retries."""
    route = respx.post("https://api.fitbit.com/oauth2/token").mock(return_value=httpx.Response(500))

    integration = await _make_integration(
        db_session, test_user.id,
        field_mapping={
            "type": "fitbit_body",
            "source_label": "fitbit",
            "data_type": "weight",
            "measure_map": {"weight": "weight_kg"},
            "refresh_token": "old-refresh",
            "client_id": "cid",
            "client_secret": "secret",
        },
    )

    with SyncLogger(integration) as log:
        ok = await sync_worker._ensure_valid_token(db_session, integration, log)

    assert ok is False
    assert route.call_count == sync_worker.MAX_REFRESH_ATTEMPTS
    await db_session.refresh(integration)
    assert integration.status == "error"


@respx.mock
async def test_ensure_valid_token_permanent_marks_needs_reauth(db_session, test_user, patch_sync_worker_db):
    respx.post("https://api.fitbit.com/oauth2/token").mock(
        return_value=httpx.Response(400, json={"error": "invalid_client"})
    )

    integration = await _make_integration(
        db_session, test_user.id,
        field_mapping={
            "type": "fitbit_body",
            "source_label": "fitbit",
            "data_type": "weight",
            "measure_map": {"weight": "weight_kg"},
            "refresh_token": "old-refresh",
            "client_id": "cid",
            "client_secret": "secret",
        },
    )

    with SyncLogger(integration) as log:
        ok = await sync_worker._ensure_valid_token(db_session, integration, log)

    assert ok is False
    await db_session.refresh(integration)
    assert integration.status == "needs_reauth"


@respx.mock
async def test_ensure_valid_token_refresh_success_writes_back_encrypted_tokens(
    db_session, test_user, patch_sync_worker_db
):
    new_access = "brand-new-access-token-abc123"
    new_refresh = "brand-new-refresh-token-def456"
    respx.post("https://api.fitbit.com/oauth2/token").mock(
        return_value=httpx.Response(
            200, json={"access_token": new_access, "refresh_token": new_refresh, "expires_in": 3600}
        )
    )

    integration = await _make_integration(
        db_session, test_user.id,
        auth_header="old-access-token",
        field_mapping={
            "type": "fitbit_body",
            "source_label": "fitbit",
            "data_type": "weight",
            "measure_map": {"weight": "weight_kg"},
            "refresh_token": "old-refresh",
            "client_id": "cid",
            "client_secret": "secret",
        },
    )

    with SyncLogger(integration) as log:
        ok = await sync_worker._ensure_valid_token(db_session, integration, log)

    assert ok is True

    # ORM read decrypts transparently.
    await db_session.refresh(integration)
    assert integration.auth_header == new_access
    assert integration.field_mapping["refresh_token"] == new_refresh
    assert integration.field_mapping["token_expires_at"] is not None

    # Raw column must NOT contain the plaintext token — it's encrypted at rest.
    row = (
        await db_session.execute(
            text("SELECT auth_header, field_mapping FROM integrations WHERE id = :id"),
            {"id": integration.id.hex},  # stored as CHAR(32) hex (no dashes) on SQLite
        )
    ).one()
    raw_auth_header, raw_field_mapping = row
    assert raw_auth_header != new_access
    assert new_access not in raw_auth_header
    assert new_refresh not in (raw_field_mapping or "")


async def test_ensure_valid_token_skips_refresh_when_not_expired(db_session, test_user, patch_sync_worker_db):
    """No respx route registered at all -- a network call here would raise."""
    integration = await _make_integration(
        db_session, test_user.id,
        auth_header="still-valid-token",
        field_mapping={
            "type": "fitbit_body",
            "source_label": "fitbit",
            "data_type": "weight",
            "measure_map": {"weight": "weight_kg"},
            "refresh_token": "old-refresh",
            "client_id": "cid",
            "client_secret": "secret",
            "token_expires_at": (datetime.now(UTC) + timedelta(hours=2)).timestamp(),
        },
    )
    with SyncLogger(integration) as log:
        ok = await sync_worker._ensure_valid_token(db_session, integration, log)
    assert ok is True


# ===========================================================================
# Upsert idempotency + swapped pct/kg auto-detect
# (documented in logging_service.upsert_weight, exercised through the exact
#  sync_worker code path that calls it: _write_weight_records)
# ===========================================================================


async def test_write_weight_records_upsert_idempotent(db_session, test_user):
    fake_integration = _FakeIntegration(test_user.id)
    log_date = date(2026, 1, 15)
    measure_map = {"1": "weight_kg"}

    with SyncLogger(fake_integration) as log:
        synced1 = await sync_worker._write_weight_records(
            db_session, test_user.id, [{"date": log_date, "1": 79.5}], measure_map, "withings", log
        )
        synced2 = await sync_worker._write_weight_records(
            db_session, test_user.id, [{"date": log_date, "1": 81.2}], measure_map, "withings", log
        )

    assert synced1 == 1
    assert synced2 == 1

    rows = (
        await db_session.execute(
            select(WeightLog).where(
                WeightLog.user_id == test_user.id,
                WeightLog.date == log_date,
                WeightLog.source == "withings",
            )
        )
    ).scalars().all()
    assert len(rows) == 1
    assert rows[0].weight_kg == 81.2


async def test_upsert_weight_swap_detection_body_fat(db_session, test_user):
    """body_fat_pct > 50 with no body_fat_kg given is implausible as a % -> swapped to kg.

    _normalize_body_comp runs its fat-swap check, then immediately runs an
    independent kg->pct swap-back check (``if body_fat_kg > weight_kg * 0.5``).
    Because that second check isn't mutually exclusive with the first, a swap
    only survives when the value clears the first threshold (>50) but not the
    second (weight_kg * 0.5) -- which requires weight_kg > 100. That's the
    actual (if surprising) documented-by-code behavior being tested here.
    """
    entry = await upsert_weight(
        db_session, test_user.id,
        weight_kg=150.0,
        body_fat_pct=60.0,
        source="swap-test-fat",
        log_date=date(2026, 2, 1),
    )
    assert entry.body_fat_kg == 60.0
    assert entry.body_fat_pct == 40.0  # round(60 / 150 * 100, 1)


async def test_upsert_weight_swap_detection_muscle_mass(db_session, test_user):
    """muscle_mass_kg > 50% of body weight with no muscle_mass_pct given is
    implausible as kg (nobody has >50% of their body weight in muscle) -> swapped to pct."""
    entry = await upsert_weight(
        db_session, test_user.id,
        weight_kg=80.0,
        muscle_mass_kg=45.0,
        source="swap-test-muscle",
        log_date=date(2026, 2, 2),
    )
    assert entry.muscle_mass_pct == 45.0
    assert entry.muscle_mass_kg == 36.0  # round(80 * 45 / 100, 2)


# ===========================================================================
# generic_json fetch: SSRF guard + run_all_syncs continuation
# ===========================================================================


async def test_sync_integration_generic_json_ssrf_blocked_marks_error(db_session, test_user, patch_sync_worker_db):
    integration = await _make_integration(
        db_session, test_user.id,
        source_url="http://127.0.0.1:59999/data",
        auth_header="fake-api-key",
        field_mapping={
            "type": "generic_json",
            "source_label": "shady_api",
            "data_type": "weight",
            "measure_map": {"weight": "weight_kg"},
        },
    )

    result = await sync_worker.sync_integration(integration.id)

    assert result["ok"] is False
    await db_session.refresh(integration)
    assert integration.status == "error"
    assert "Refused to fetch" in integration.field_mapping["last_error"]


@respx.mock
async def test_run_all_syncs_continues_past_blocked_integration(db_session, test_user, patch_sync_worker_db):
    """One integration is SSRF-blocked; a second, healthy one must still sync
    in the same run_all_syncs() call, and the call itself must not raise."""
    blocked = await _make_integration(
        db_session, test_user.id,
        source_url="http://127.0.0.1:59999/data",
        auth_header="fake-api-key",
        field_mapping={
            "type": "generic_json",
            "source_label": "shady_api",
            "data_type": "weight",
            "measure_map": {"weight": "weight_kg"},
        },
    )

    ts = int(datetime.now(UTC).timestamp())
    respx.post("https://wbsapi.withings.net/measure").mock(
        return_value=httpx.Response(
            200,
            json={
                "status": 0,
                "body": {"measuregrps": [{"date": ts, "measures": [{"type": 1, "value": 800, "unit": -1}]}]},
            },
        )
    )
    healthy = await _make_integration(
        db_session, test_user.id,
        source_url="https://wbsapi.withings.net/measure",
        auth_header="fake-access-token",
        field_mapping={
            "type": "withings_measure",
            "source_label": "withings",
            "data_type": "weight",
            "measure_map": {"1": "weight_kg"},
        },
    )

    await sync_worker.run_all_syncs()  # must not raise

    await db_session.refresh(blocked)
    await db_session.refresh(healthy)
    assert blocked.status == "error"
    assert healthy.status == "active"

    weight_rows = (
        await db_session.execute(
            select(WeightLog).where(WeightLog.user_id == test_user.id, WeightLog.source == "withings")
        )
    ).scalars().all()
    assert len(weight_rows) == 1
    assert weight_rows[0].weight_kg == 80.0
