"""Imported nutrients are sanity checked, typed in ones validated, and stats records make sense."""

from __future__ import annotations

from datetime import timedelta

import pytest

from app.external import usda
from app.external.nutrient_checks import clean_imported
from app.external.openfoodfacts import parse_nutrients
from app.schemas.food import NutrientData
from app.services.clock import today_for


def test_impossible_imported_values_are_dropped():
    n = clean_imported(NutrientData(kcal=350, protein=12, carbs=60, sugar=75, fat=5, sat_fat=9, salt=180))
    assert n.sugar is None  # more sugar than carbs
    assert n.sat_fat is None  # more saturated than total fat
    assert n.salt is None  # more than 100 g in 100 g
    assert (n.protein, n.carbs, n.fat) == (12, 60, 5)


def test_kj_typed_into_the_kcal_field():
    n = parse_nutrients({"energy-kcal_100g": 1674, "energy-kj_100g": 1674, "proteins_100g": 10}, None)
    assert n.kcal == pytest.approx(400, abs=0.1)
    # Too high for any food and no kJ to fall back on: missing beats wrong.
    assert parse_nutrients({"energy-kcal_100g": 2500}, None).kcal is None


def test_missing_kcal_is_estimated_from_macros():
    n = parse_nutrients({"proteins_100g": 10, "carbohydrates_100g": 20, "fat_100g": 5}, None)
    assert n.kcal == 165
    # Not all of protein, carbs and fat known: no guess.
    assert parse_nutrients({"proteins_100g": 10}, None).kcal is None


class _Resp:
    status_code = 200

    def __init__(self, data):
        self._data = data

    def json(self):
        return self._data


def _usda_food(gtin, **extra):
    return {
        "description": "PEANUT BUTTER",
        "gtinUpc": gtin,
        "servingSize": 32,
        "servingSizeUnit": "g",
        "householdServingFullText": "2 Tbsp",
        "foodNutrients": [
            {"nutrientId": 1008, "value": 594},
            {"nutrientId": 1003, "value": 22},
            {"nutrientId": 1005, "value": 22},
            {"nutrientId": 1004, "value": 50},
            {"nutrientId": 1404, "value": 0.05},
            {"nutrientId": 1093, "value": 400},
        ],
        **extra,
    }


@pytest.mark.asyncio
async def test_usda_only_accepts_the_same_barcode(monkeypatch):
    foods = [_usda_food("999999999999"), _usda_food("0051500255162")]

    async def fake_get(self, url, params=None):
        return _Resp({"foods": foods})

    monkeypatch.setattr(usda.settings, "usda_api_key", "test", raising=False)
    monkeypatch.setattr(usda.httpx.AsyncClient, "get", fake_get)

    result = await usda.lookup_barcode("051500255162")  # UPC-A of the second food's EAN
    assert result is not None
    name, n, serving_g, label = result
    assert serving_g == 32 and label == "2 Tbsp"
    assert n.omega3 == 50  # grams to mg
    assert n.salt == 1.0

    foods = [_usda_food("999999999999")]
    assert await usda.lookup_barcode("051500255162") is None


@pytest.mark.asyncio
async def test_typed_in_nutrients_reject_negative_and_nan(async_client, api_key_headers):
    for bad in ({"kcal": -5}, {"kcal": 100, "protein": "NaN"}, {"kcal": 100, "fat": "Infinity"}):
        resp = await async_client.post("/api/foods", json={"name": "Bad", "nutrients": bad}, headers=api_key_headers)
        assert resp.status_code == 422, bad
    # Rough whole meal foods stay allowed: the meal counted as 100 g.
    resp = await async_client.post(
        "/api/foods",
        json={"name": "Estimated dinner", "nutrients": {"kcal": 1000, "carbs": 120, "fat": 40}},
        headers=api_key_headers,
    )
    assert resp.status_code == 201
    resp = await async_client.post(
        "/api/foods", json={"name": "Zero serving", "serving_size_g": 0, "nutrients": {"kcal": 1}}, headers=api_key_headers
    )
    assert resp.status_code == 422
    resp = await async_client.post("/api/foods", json={"name": "x" * 256, "nutrients": {"kcal": 1}}, headers=api_key_headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_food_update_adds_nutrients_to_a_food_without_any(async_client, api_key_headers, db_session):
    from sqlalchemy import select

    from app.models.nutrient import Nutrient

    resp = await async_client.post("/api/foods", json={"name": "Blank food", "nutrients": {}}, headers=api_key_headers)
    food_id = resp.json()["id"]
    from uuid import UUID

    await db_session.execute(Nutrient.__table__.delete().where(Nutrient.food_id == UUID(food_id)))
    await db_session.commit()

    resp = await async_client.put(f"/api/foods/{food_id}", json={"nutrients": {"kcal": 250}}, headers=api_key_headers)
    assert resp.status_code == 200
    assert resp.json()["nutrients"]["kcal"] == 250
    row = (await db_session.execute(select(Nutrient).where(Nutrient.food_id == UUID(food_id)))).scalar_one()
    assert row.kcal == 250
    # A null name means "leave it", not a crash.
    resp = await async_client.put(f"/api/foods/{food_id}", json={"name": None}, headers=api_key_headers)
    assert resp.status_code == 200 and resp.json()["name"] == "Blank food"


@pytest.mark.asyncio
async def test_streak_and_lowest_day(async_client, api_key_headers, test_user):
    resp = await async_client.post(
        "/api/foods", json={"name": "Streak oats", "nutrients": {"kcal": 380, "protein": 13, "carbs": 60, "fat": 7}},
        headers=api_key_headers,
    )
    assert resp.status_code == 201
    food_id = resp.json()["id"]
    resp = await async_client.post(
        "/api/foods", json={"name": "Streak water", "nutrients": {"kcal": 0}}, headers=api_key_headers
    )
    water_id = resp.json()["id"]
    today = today_for(test_user)

    async def log(fid, day, grams):
        r = await async_client.post(
            "/api/agent/log/food",
            json={"food_id": fid, "quantity_g": grams, "meal_type": "breakfast", "date": str(day)},
            headers=api_key_headers,
        )
        assert r.status_code == 201, r.text

    # Yesterday and the day before, nothing yet today: still a 2 day streak.
    await log(food_id, today - timedelta(days=1), 100)
    await log(food_id, today - timedelta(days=2), 200)
    await log(water_id, today - timedelta(days=3), 500)  # a zero calorie day
    data = (await async_client.get("/api/agent/summary/stats?days=30", headers=api_key_headers)).json()
    assert data["current_streak"] == 3
    assert data["lowest_calorie_day"]["date"] == str(today - timedelta(days=1))

    # A small start to today is not the lowest day yet.
    await log(food_id, today, 10)
    data = (await async_client.get("/api/agent/summary/stats?days=30", headers=api_key_headers)).json()
    assert data["current_streak"] == 4
    assert data["lowest_calorie_day"]["date"] == str(today - timedelta(days=1))
