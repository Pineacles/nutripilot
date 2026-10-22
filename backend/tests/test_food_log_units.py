"""Food logs remember the amount and unit they were entered in, and recent foods
offer that amount again."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio


async def _food(client, headers, name, serving_g=None):
    resp = await client.post(
        "/api/foods",
        json={"name": name, "serving_size_g": serving_g, "serving_label": "1 bar" if serving_g else None,
              "nutrients": {"kcal": 400, "protein": 20}},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def test_servings_are_remembered_as_servings(async_client, auth_headers):
    food_id = await _food(async_client, auth_headers, "Unit test bar", serving_g=50)
    resp = await async_client.post(
        "/api/agent/log/food",
        json={"food_id": food_id, "servings": 1.5, "meal_type": "snack", "date": "2026-10-01"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert (data["quantity_g"], data["amount"], data["unit"]) == (75, 1.5, "serving")
    assert data["kcal"] == 300

    day = (await async_client.get("/api/agent/log/food?day=2026-10-01", headers=auth_headers)).json()
    entry = next(e for e in day["entries"] if e["food_id"] == food_id)
    assert (entry["amount"], entry["unit"]) == (1.5, "serving")


async def test_grams_and_editing_between_units(async_client, auth_headers):
    food_id = await _food(async_client, auth_headers, "Unit test cereal", serving_g=40)
    log = (await async_client.post(
        "/api/agent/log/food",
        json={"food_id": food_id, "quantity_g": 120, "meal_type": "breakfast", "date": "2026-10-02"},
        headers=auth_headers,
    )).json()
    assert (log["amount"], log["unit"]) == (120, "g")

    edited = (await async_client.put(f"/api/agent/log/food/{log['id']}", json={"servings": 2}, headers=auth_headers)).json()
    assert (edited["quantity_g"], edited["amount"], edited["unit"]) == (80, 2, "serving")

    edited = (await async_client.put(f"/api/agent/log/food/{log['id']}", json={"quantity_g": 55}, headers=auth_headers)).json()
    assert (edited["quantity_g"], edited["amount"], edited["unit"]) == (55, 55, "g")


async def test_servings_without_a_serving_size_fall_back_to_100g(async_client, auth_headers):
    food_id = await _food(async_client, auth_headers, "Unit test rice")
    data = (await async_client.post(
        "/api/agent/log/food",
        json={"food_id": food_id, "servings": 2, "meal_type": "lunch"},
        headers=auth_headers,
    )).json()
    assert (data["quantity_g"], data["amount"], data["unit"]) == (200, 200, "g")


async def test_recent_foods_offer_the_last_amount(async_client, auth_headers):
    food_id = await _food(async_client, auth_headers, "Unit test yogurt", serving_g=150)
    for servings in (1, 2):
        await async_client.post(
            "/api/agent/log/food",
            json={"food_id": food_id, "servings": servings, "meal_type": "breakfast"},
            headers=auth_headers,
        )
    resp = await async_client.get("/api/dashboard/foods/recent", headers=auth_headers)
    assert resp.status_code == 200
    item = next(r for r in resp.json() if r["id"] == food_id)
    assert item["uses"] == 2
    assert (item["last_amount"], item["last_unit"], item["last_meal_type"]) == (2, "serving", "breakfast")
    assert item["serving_size_g"] == 150


async def test_too_many_servings_is_rejected(async_client, auth_headers):
    food_id = await _food(async_client, auth_headers, "Unit test pot", serving_g=500)
    resp = await async_client.post(
        "/api/agent/log/food",
        json={"food_id": food_id, "servings": 30, "meal_type": "dinner"},
        headers=auth_headers,
    )
    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "QUANTITY_TOO_LARGE"
