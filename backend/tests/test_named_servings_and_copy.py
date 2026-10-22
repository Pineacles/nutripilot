"""Named servings ("slice" = 30 g) per user and food, and copying a meal or day."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio


async def _food(client, headers, name, serving_g=None):
    resp = await client.post(
        "/api/foods",
        json={"name": name, "serving_size_g": serving_g, "nutrients": {"kcal": 250, "protein": 10}},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _log(client, headers, food_id, day, meal, **amount):
    resp = await client.post(
        "/api/agent/log/food", json={"food_id": food_id, "meal_type": meal, "date": day, **amount}, headers=headers
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_named_serving_logs_and_shows_back(async_client, auth_headers):
    food_id = await _food(async_client, auth_headers, "Serving test bread", serving_g=500)
    resp = await async_client.post(
        f"/api/foods/{food_id}/servings", json={"label": " slice ", "grams": 30}, headers=auth_headers
    )
    assert resp.status_code == 201
    serving = resp.json()
    assert serving["label"] == "slice"

    detail = (await async_client.get(f"/api/dashboard/foods/{food_id}", headers=auth_headers)).json()
    assert [s["label"] for s in detail["servings"]] == ["slice"]

    log = await _log(async_client, auth_headers, food_id, "2026-10-05", "breakfast", servings=2, serving_id=serving["id"])
    assert (log["quantity_g"], log["amount"], log["unit"], log["unit_label"]) == (60, 2, "serving", "slice")
    assert log["kcal"] == 150

    recent = next(r for r in (await async_client.get("/api/dashboard/foods/recent", headers=auth_headers)).json()
                  if r["id"] == food_id)
    assert recent["last_unit_label"] == "slice"

    # Back to the food's own serving clears the name.
    edited = (await async_client.put(f"/api/agent/log/food/{log['id']}", json={"servings": 1}, headers=auth_headers)).json()
    assert (edited["quantity_g"], edited["unit_label"]) == (500, None)
    edited = (await async_client.put(
        f"/api/agent/log/food/{log['id']}", json={"servings": 3, "serving_id": serving["id"]}, headers=auth_headers
    )).json()
    assert (edited["quantity_g"], edited["unit_label"]) == (90, "slice")

    # Removing the serving keeps the log as it was.
    assert (await async_client.delete(f"/api/foods/{food_id}/servings/{serving['id']}", headers=auth_headers)).status_code == 204
    day = (await async_client.get("/api/agent/log/food?day=2026-10-05", headers=auth_headers)).json()
    entry = next(e for e in day["entries"] if e["id"] == log["id"])
    assert (entry["quantity_g"], entry["unit_label"]) == (90, "slice")


async def test_duplicate_and_unknown_servings(async_client, auth_headers):
    food_id = await _food(async_client, auth_headers, "Serving test cheese")
    first = await async_client.post(f"/api/foods/{food_id}/servings", json={"label": "Slice", "grams": 20}, headers=auth_headers)
    assert first.status_code == 201
    dup = await async_client.post(f"/api/foods/{food_id}/servings", json={"label": "slice", "grams": 25}, headers=auth_headers)
    assert dup.status_code == 409
    assert dup.json()["detail"]["code"] == "SERVING_EXISTS"

    other_food = await _food(async_client, auth_headers, "Serving test ham")
    resp = await async_client.post(
        "/api/agent/log/food",
        json={"food_id": other_food, "servings": 1, "serving_id": first.json()["id"], "meal_type": "lunch"},
        headers=auth_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["detail"]["code"] == "SERVING_NOT_FOUND"


async def test_copy_a_meal_to_another_day_and_meal(async_client, auth_headers):
    oats = await _food(async_client, auth_headers, "Copy test oats", serving_g=40)
    milk = await _food(async_client, auth_headers, "Copy test milk")
    await _log(async_client, auth_headers, oats, "2026-10-10", "breakfast", servings=1.5)
    await _log(async_client, auth_headers, milk, "2026-10-10", "breakfast", quantity_g=200)
    await _log(async_client, auth_headers, milk, "2026-10-10", "dinner", quantity_g=100)

    resp = await async_client.post(
        "/api/agent/log/food/copy",
        json={"from_date": "2026-10-10", "to_date": "2026-10-11", "meal_type": "breakfast"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    copied = resp.json()
    assert [(c["food_name"], c["amount"], c["unit"], c["date"]) for c in copied] == [
        ("Copy test oats", 1.5, "serving", "2026-10-11"),
        ("Copy test milk", 200, "g", "2026-10-11"),
    ]

    # Whole day into the same date is refused; one meal into another meal the same day is fine.
    same = await async_client.post(
        "/api/agent/log/food/copy", json={"from_date": "2026-10-10", "to_date": "2026-10-10"}, headers=auth_headers
    )
    assert same.status_code == 422
    moved = await async_client.post(
        "/api/agent/log/food/copy",
        json={"from_date": "2026-10-10", "to_date": "2026-10-10", "meal_type": "dinner", "to_meal_type": "snack"},
        headers=auth_headers,
    )
    assert moved.status_code == 201
    assert moved.json()[0]["meal_type"] == "snack"

    empty = await async_client.post(
        "/api/agent/log/food/copy",
        json={"from_date": "2026-09-01", "to_date": "2026-10-11", "meal_type": "lunch"},
        headers=auth_headers,
    )
    assert empty.status_code == 404
    assert empty.json()["detail"]["code"] == "NOTHING_TO_COPY"


async def test_named_serving_total_is_capped_and_serving_id_needs_servings(async_client, auth_headers):
    food_id = await _food(async_client, auth_headers, "Serving test sack")
    serving = (await async_client.post(
        f"/api/foods/{food_id}/servings", json={"label": "sack", "grams": 5000}, headers=auth_headers
    )).json()
    too_big = await async_client.post(
        "/api/agent/log/food",
        json={"food_id": food_id, "servings": 3, "serving_id": serving["id"], "meal_type": "lunch"},
        headers=auth_headers,
    )
    assert too_big.status_code == 422
    assert too_big.json()["detail"]["code"] == "QUANTITY_TOO_LARGE"

    log = await _log(async_client, auth_headers, food_id, "2026-10-12", "lunch", quantity_g=100)
    lone = await async_client.put(f"/api/agent/log/food/{log['id']}", json={"serving_id": serving["id"]}, headers=auth_headers)
    assert lone.status_code == 422
    mixed = await async_client.post(
        "/api/agent/log/food",
        json={"food_id": food_id, "quantity_g": 50, "serving_id": serving["id"], "meal_type": "lunch"},
        headers=auth_headers,
    )
    assert mixed.status_code == 422
