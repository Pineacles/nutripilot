"""Daily summary endpoint tests."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio


async def test_summary_today_empty(async_client, api_key_headers, test_user):
    """Summary should return successfully even with no food logged."""
    resp = await async_client.get("/api/agent/summary/today", headers=api_key_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "totals" in data
    assert "targets" in data
    assert "meals" in data
    assert data["totals"]["kcal"] == 0.0


async def test_summary_today_after_logging(async_client, api_key_headers):
    """After logging food, summary totals should reflect it."""
    food_resp = await async_client.post(
        "/api/foods",
        json={
            "name": "Summary Test Rice",
            "source": "manual",
            "nutrients": {"kcal": 130, "protein": 2.7, "carbs": 28.2, "fat": 0.3},
        },
        headers=api_key_headers,
    )
    assert food_resp.status_code == 201

    log_resp = await async_client.post(
        "/api/agent/log/food-by-name",
        json={"food_name": "Summary Test Rice", "quantity_g": 200, "meal_type": "lunch"},
        headers=api_key_headers,
    )
    assert log_resp.status_code == 201

    summary = await async_client.get("/api/agent/summary/today", headers=api_key_headers)
    assert summary.status_code == 200
    data = summary.json()
    assert data["totals"]["kcal"] >= 200  # 130 * 2 = 260


async def test_summary_week(async_client, api_key_headers):
    resp = await async_client.get("/api/agent/summary/week", headers=api_key_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "daily_avg" in data
