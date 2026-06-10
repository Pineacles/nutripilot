"""Food CRUD and log_food tests."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio

_FOOD_PAYLOAD = {
    "name": "Test Chicken Breast",
    "source": "manual",
    "nutrients": {
        "kcal": 165,
        "protein": 31.0,
        "carbs": 0.0,
        "fat": 3.6,
        "fiber": 0.0,
        "sugar": 0.0,
        "salt": 0.07,
        "calcium": 15.0,
        "iron": 1.0,
    },
}


async def test_create_food(async_client, api_key_headers):
    resp = await async_client.post("/api/foods", json=_FOOD_PAYLOAD, headers=api_key_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Chicken Breast"
    assert "id" in data


async def test_create_food_requires_auth(async_client, test_user):
    resp = await async_client.post("/api/foods", json=_FOOD_PAYLOAD)
    assert resp.status_code == 401


async def test_log_food_by_name(async_client, api_key_headers):
    create_resp = await async_client.post(
        "/api/foods", json={**_FOOD_PAYLOAD, "name": "Log Chicken Test"}, headers=api_key_headers
    )
    assert create_resp.status_code == 201

    resp = await async_client.post(
        "/api/agent/log/food-by-name",
        json={"food_name": "Log Chicken Test", "quantity_g": 200, "meal_type": "lunch"},
        headers=api_key_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["quantity_g"] == 200
    assert data["meal_type"] == "lunch"
    assert abs(data["kcal"] - 330.0) < 1


async def test_log_food_by_name_not_found(async_client, api_key_headers):
    resp = await async_client.post(
        "/api/agent/log/food-by-name",
        json={"food_name": "absolutely-nonexistent-xyz-food-99999", "quantity_g": 100, "meal_type": "snack"},
        headers=api_key_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["detail"]["code"] == "FOOD_NOT_FOUND_BY_NAME"


async def test_log_food_quantity_g_wins_over_servings(async_client, api_key_headers):
    """quantity_g should beat servings in resolution priority."""
    create_resp = await async_client.post(
        "/api/foods", json={**_FOOD_PAYLOAD, "name": "Priority Test Chicken"}, headers=api_key_headers
    )
    assert create_resp.status_code == 201

    resp = await async_client.post(
        "/api/agent/log/food-by-name",
        json={"food_name": "Priority Test Chicken", "quantity_g": 150, "servings": 2, "meal_type": "dinner"},
        headers=api_key_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["quantity_g"] == 150


async def test_log_food_by_id(async_client, api_key_headers):
    create_resp = await async_client.post(
        "/api/foods", json={**_FOOD_PAYLOAD, "name": "ByID Test Chicken"}, headers=api_key_headers
    )
    assert create_resp.status_code == 201
    food_id = create_resp.json()["id"]

    resp = await async_client.post(
        "/api/agent/log/food",
        json={"food_id": food_id, "quantity_g": 100, "meal_type": "snack"},
        headers=api_key_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert abs(data["kcal"] - 165.0) < 1
