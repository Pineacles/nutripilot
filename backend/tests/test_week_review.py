"""Weekly review: logging and intake against targets, weight trend, and the factual flags."""

from __future__ import annotations

import uuid
from datetime import timedelta

import pytest

from app.models.micronutrient_target import MicronutrientTarget
from app.services.clock import today_for
from app.services.review_service import review_flags


async def _food(client, headers, kcal, protein, fiber):
    resp = await client.post(
        "/api/foods",
        json={"name": f"Review meal {uuid.uuid4().hex[:6]}", "nutrients": {"kcal": kcal, "protein": protein, "fiber": fiber, "calcium": 10}},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _log(client, headers, food_id, grams, day):
    resp = await client.post(
        "/api/agent/log/food",
        json={"food_id": food_id, "quantity_g": grams, "meal_type": "dinner", "date": str(day)},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text


@pytest.mark.asyncio
async def test_empty_review(async_client, api_key_headers, test_user):
    data = (await async_client.get("/api/agent/review/week", headers=api_key_headers)).json()
    yesterday = today_for(test_user) - timedelta(days=1)
    assert data["end"] == str(yesterday) and len(data["days"]) == 7
    assert data["intake"]["logged_days"] == 0 and data["intake"]["avg_kcal"] is None
    assert data["weight"]["trend_end_kg"] is None
    assert [f["code"] for f in data["flags"]] == ["logging_gaps"]


@pytest.mark.asyncio
async def test_week_review_counts_and_flags(async_client, api_key_headers, test_user, db_session):
    db_session.add(MicronutrientTarget(user_id=test_user.id, nutrient="calcium", target_value=1000, unit="mg"))
    await db_session.commit()
    end = today_for(test_user) - timedelta(days=1)
    start = end - timedelta(days=6)
    meal = await _food(async_client, api_key_headers, 180, 10, 1)  # 1000 g: 1800 kcal, 100 g protein, 10 g fiber
    for i in range(7):
        day = start + timedelta(days=i)
        if i == 3:
            continue  # one day not logged
        if i == 2:
            await _log(async_client, api_key_headers, meal, 200, day)  # a light day: 360 kcal
            continue
        await _log(async_client, api_key_headers, meal, 1000 if day.weekday() < 5 else 1300, day)
    for i in range(30):
        day = end - timedelta(days=i)
        resp = await async_client.post("/api/agent/log/weight", json={"weight_kg": 90 + 0.05 * i, "date": str(day)}, headers=api_key_headers)
        assert resp.status_code == 201, resp.text
    # Today is never part of the default review.
    await _log(async_client, api_key_headers, meal, 5000, end + timedelta(days=1))

    data = (await async_client.get("/api/agent/review/week", headers=api_key_headers)).json()
    intake = data["intake"]
    assert data["start"] == str(start) and data["end"] == str(end)
    assert intake["logged_days"] == 6 and intake["full_days"] == 5
    assert intake["avg_protein_g"] is not None and intake["avg_protein_g"] < 150
    assert intake["protein_met_days"] == 0 and intake["fiber_met_days"] == 0
    weekend = [d for d in data["days"] if d["logged"] and d["kcal"] >= 1000 and d["weekday"] in ("Sat", "Sun")]
    assert intake["kcal_window_days"] == 5 - len(weekend)
    assert data["days"][3]["logged"] is False and data["days"][2]["kcal"] == 360
    assert data["weight"]["weigh_in_days"] == 7 and data["weight"]["trend_change_kg"] < 0
    codes = {f["code"] for f in data["flags"]}
    assert {"light_days", "protein_low", "fiber_low", "micronutrient_low"} <= codes
    assert "logging_gaps" not in codes
    assert data["micronutrient_gaps"][0]["nutrient"] == "calcium"
    assert data["targets"]["safe_floor_kcal"] == 1200

    other = (await async_client.get(f"/api/agent/review/week?end_date={end - timedelta(days=7)}", headers=api_key_headers)).json()
    assert other["intake"]["logged_days"] == 0
    assert data["previous_week"]["logged_days"] == 0


def _flags(**over):
    base = dict(
        logged_days=7, light_days=0, avg_protein=150.0, target_protein=150.0, avg_fiber=30.0, target_fiber=30.0,
        weekday_kcal=1800.0, weekend_kcal=1900.0, under_floor_days=0, hard_floor=1500.0, fiber_coverage=0.9, thin_data=[], rate_pct=-0.5, rate_kg=-0.45, weigh_ins=10,
        trend_kg=90.0, target_weight=80.0, micro_gaps=[],
    )
    return {f.code for f in review_flags(**{**base, **over})}


def test_flags_quiet_on_a_good_week():
    assert _flags() == set()


@pytest.mark.parametrize("over, code", [
    ({"logged_days": 5}, "logging_gaps"),
    ({"light_days": 1}, "light_days"),
    ({"under_floor_days": 2}, "under_safe_floor"),
    ({"avg_protein": 120.0}, "protein_low"),
    ({"avg_fiber": 20.0}, "fiber_low"),
    ({"weekend_kcal": 2200.0}, "weekend_higher"),
    ({"rate_pct": -1.4}, "loss_too_fast"),
    ({"rate_pct": 0.1, "rate_kg": 0.1}, "trend_not_falling"),
])
def test_each_flag(over, code):
    assert code in _flags(**over)


def test_rate_flags_need_enough_weigh_ins_and_a_lower_goal():
    assert "loss_too_fast" not in _flags(rate_pct=-1.4, weigh_ins=3)
    assert "trend_not_falling" not in _flags(rate_pct=0.1, rate_kg=0.1, target_weight=None)
    assert "trend_not_falling" not in _flags(rate_pct=0.1, rate_kg=0.1, target_weight=95.0)
    assert "under_safe_floor" not in _flags(under_floor_days=1)


def test_thin_nutrient_data_is_not_a_gap():
    assert "fiber_low" not in _flags(avg_fiber=7.0, fiber_coverage=0.6)
    assert "nutrient_data_thin" in _flags(thin_data=["fiber", "zinc"])
