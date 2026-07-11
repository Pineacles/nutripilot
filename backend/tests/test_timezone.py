"""Per-user timezone day-boundary correctness."""

from __future__ import annotations

import uuid
from datetime import datetime
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
