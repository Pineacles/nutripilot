"""Per-user timezone day-boundary correctness."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from datetime import date as date_type
from zoneinfo import ZoneInfo

import pytest
from passlib.context import CryptContext

from app.models.user import User

pytestmark = pytest.mark.asyncio

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def _make_user(db_session, tz: str) -> str:
    """Create a user with the given timezone; return its API key."""
    api_key = f"tz-test-key-{uuid.uuid4().hex}"
    user = User(
        id=uuid.uuid4(),
        email=f"tz-{uuid.uuid4().hex[:10]}@nutripilot.dev",
        password_hash=_pwd.hash("x"),
        api_key=api_key,
        target_kcal=2000,
        target_protein_g=150,
        target_carbs_g=250,
        target_fat_g=70,
        target_fiber_g=30,
        target_sugar_g=50,
        target_sodium_mg=2300,
        target_alcohol_g=0,
        target_water_ml=2500,
        target_caffeine_mg=400,
        timezone=tz,
    )
    db_session.add(user)
    await db_session.commit()
    return api_key


@pytest.mark.parametrize("tz", ["Pacific/Kiritimati", "Etc/GMT+12", "Europe/Zurich"])
async def test_today_summary_uses_user_timezone(async_client, db_session, tz):
    """summary/today default date must equal today in the user's timezone."""
    api_key = await _make_user(db_session, tz)
    expected = datetime.now(ZoneInfo(tz)).date().isoformat()

    resp = await async_client.get("/api/agent/summary/today", headers={"X-API-Key": api_key})
    assert resp.status_code == 200
    assert resp.json()["date"] == expected


@pytest.mark.parametrize("tz", ["Pacific/Kiritimati", "Etc/GMT+12"])
async def test_food_log_default_date_uses_user_timezone(async_client, db_session, tz):
    """The food-log listing default day must be today in the user's timezone."""
    api_key = await _make_user(db_session, tz)
    expected = datetime.now(ZoneInfo(tz)).date().isoformat()

    resp = await async_client.get("/api/agent/log/food", headers={"X-API-Key": api_key})
    assert resp.status_code == 200
    assert resp.json()["date"] == expected


async def test_logged_food_lands_on_user_local_day(async_client, db_session):
    """A food logged without an explicit date lands on the user's local day."""
    tz = "Pacific/Kiritimati"
    api_key = await _make_user(db_session, tz)
    headers = {"X-API-Key": api_key}
    expected = datetime.now(ZoneInfo(tz)).date().isoformat()

    await async_client.post(
        "/api/foods",
        json={"name": "TZ Rice", "nutrients": {"kcal": 130, "protein": 2.7}},
        headers=headers,
    )
    log_resp = await async_client.post(
        "/api/agent/log/food-by-name",
        json={"food_name": "TZ Rice", "quantity_g": 100, "meal_type": "lunch"},
        headers=headers,
    )
    assert log_resp.status_code == 201
    assert log_resp.json()["date"] == expected


async def test_settings_update_valid_timezone(async_client, auth_headers, test_user):
    """Updating the timezone through settings persists and is returned."""
    body = {
        "target_kcal": 2000, "target_protein_g": 150, "target_carbs_g": 250,
        "target_fat_g": 70, "target_fiber_g": 30, "target_sugar_g": 50,
        "target_sodium_mg": 2300, "target_alcohol_g": 0, "target_water_ml": 2500,
        "target_caffeine_mg": 400, "timezone": "America/New_York",
    }
    resp = await async_client.put("/api/v1/settings/nutrition-targets", json=body, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["timezone"] == "America/New_York"

    get_resp = await async_client.get("/api/v1/settings", headers=auth_headers)
    assert get_resp.json()["nutrition_targets"]["timezone"] == "America/New_York"


async def test_settings_update_invalid_timezone_returns_422(async_client, auth_headers, test_user):
    body = {
        "target_kcal": 2000, "target_protein_g": 150, "target_carbs_g": 250,
        "target_fat_g": 70, "target_fiber_g": 30, "target_sugar_g": 50,
        "target_sodium_mg": 2300, "target_alcohol_g": 0, "target_water_ml": 2500,
        "target_caffeine_mg": 400, "timezone": "Mars/Olympus_Mons",
    }
    resp = await async_client.put("/api/v1/settings/nutrition-targets", json=body, headers=auth_headers)
    assert resp.status_code == 422


async def test_agent_settings_update_invalid_timezone_returns_422(async_client, api_key_headers):
    body = {
        "target_kcal": 2000, "target_protein_g": 150, "target_carbs_g": 250,
        "target_fat_g": 70, "target_fiber_g": 30, "target_sugar_g": 50,
        "target_sodium_mg": 2300, "target_alcohol_g": 0, "target_water_ml": 2500,
        "target_caffeine_mg": 400, "timezone": "Not/AZone",
    }
    resp = await async_client.put("/api/agent/settings/nutrition-targets", json=body, headers=api_key_headers)
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Frozen-time boundary test.
#
# The parametrized tests above compute their "expected" date dynamically via
# ZoneInfo, which is correct but doesn't *guarantee* local date != UTC date at
# run time -- for Pacific/Kiritimati (UTC+14) that's only true during 14/24
# hours of the day, so a regression to plain UTC could slip through if CI
# happens to run in the other 10-hour window. Freeze the clock at a known
# instant that unambiguously straddles the boundary instead.
# ---------------------------------------------------------------------------

# 2026-03-10 20:00 UTC. Kiritimati is UTC+14 -> local time is 2026-03-11 10:00,
# a different calendar date than UTC's.
_FROZEN_UTC_INSTANT = datetime(2026, 3, 10, 20, 0, tzinfo=UTC)
_FROZEN_UTC_DATE = date_type(2026, 3, 10)
_FROZEN_KIRITIMATI_DATE = date_type(2026, 3, 11)


class _FrozenDatetime(datetime):
    """A datetime subclass whose .now() always returns the same frozen instant."""

    @classmethod
    def now(cls, tz=None):
        if tz is None:
            return _FROZEN_UTC_INSTANT.replace(tzinfo=None)
        return _FROZEN_UTC_INSTANT.astimezone(tz)


@pytest.fixture()
def frozen_clock(monkeypatch):
    """Freeze app.services.clock's notion of "now" at _FROZEN_UTC_INSTANT.

    Patches the ``datetime`` name inside app.services.clock (not the stdlib
    module globally) so today_utc()/today_for() -- and anything that calls
    them, e.g. the food-log router and summary_service -- see the frozen
    instant, while the rest of the test process keeps real time.
    """
    import app.services.clock as clock

    monkeypatch.setattr(clock, "datetime", _FrozenDatetime)
    assert clock.today_utc() == _FROZEN_UTC_DATE  # sanity: patch took effect


async def test_today_for_and_today_utc_disagree_at_frozen_instant(frozen_clock):
    """Unit-level: today_for() resolves the user-local date, not the UTC date."""
    from app.services.clock import today_for, today_utc

    class _FakeUser:
        timezone = "Pacific/Kiritimati"

    assert today_utc() == _FROZEN_UTC_DATE
    assert today_for(_FakeUser()) == _FROZEN_KIRITIMATI_DATE
    assert today_for(_FakeUser()) != today_utc()


async def test_frozen_food_log_and_today_summary_use_local_date(
    async_client, db_session, frozen_clock
):
    """End-to-end: at a frozen instant where local date != UTC date, a food
    logged without an explicit date lands on the user-local day, and
    GET /summary/today (same default-date resolution) picks it up."""
    api_key = await _make_user(db_session, "Pacific/Kiritimati")
    headers = {"X-API-Key": api_key}

    await async_client.post(
        "/api/foods",
        json={"name": "Frozen Clock Rice", "nutrients": {"kcal": 130, "protein": 2.7}},
        headers=headers,
    )
    log_resp = await async_client.post(
        "/api/agent/log/food-by-name",
        json={"food_name": "Frozen Clock Rice", "quantity_g": 100, "meal_type": "lunch"},
        headers=headers,
    )
    assert log_resp.status_code == 201
    assert log_resp.json()["date"] == _FROZEN_KIRITIMATI_DATE.isoformat()
    assert log_resp.json()["date"] != _FROZEN_UTC_DATE.isoformat()

    summary_resp = await async_client.get("/api/agent/summary/today", headers=headers)
    assert summary_resp.status_code == 200
    summary = summary_resp.json()
    assert summary["date"] == _FROZEN_KIRITIMATI_DATE.isoformat()
    assert summary["totals"]["kcal"] == pytest.approx(130.0)
