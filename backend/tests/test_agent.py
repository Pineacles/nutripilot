"""Agent API: weight log, water log, caffeine (deprecated) endpoint tests."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio


async def test_log_weight(async_client, api_key_headers):
    resp = await async_client.post(
        "/api/agent/log/weight",
        json={"weight_kg": 82.5, "body_fat_pct": 18.0, "source": "manual"},
        headers=api_key_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["weight_kg"] == 82.5
    assert data["body_fat_pct"] == 18.0


async def test_log_water(async_client, api_key_headers):
    resp = await async_client.post(
        "/api/agent/log/water",
        json={"amount_ml": 500},
        headers=api_key_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["amount_ml"] == 500


async def test_deprecated_caffeine_endpoint_still_works(async_client, api_key_headers):
    """The /api/agent/log/caffeine endpoint must remain functional."""
    resp = await async_client.post(
        "/api/agent/log/caffeine",
        json={"amount_mg": 80, "source_name": "espresso"},
        headers=api_key_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["amount_mg"] == 80


async def test_get_settings(async_client, api_key_headers):
    resp = await async_client.get("/api/agent/settings", headers=api_key_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "nutrition_targets" in data
    assert "api_key_masked" in data
    # API key must be masked (never returned in full via settings)
    assert data["api_key_masked"].startswith("...")
