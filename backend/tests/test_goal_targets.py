"""Goal targets: target_weight_kg + target_body_fat_pct via both routers."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio

_BASE = {
    "target_kcal": 2200, "target_protein_g": 160, "target_carbs_g": 250,
    "target_fat_g": 70, "target_fiber_g": 30, "target_sugar_g": 50,
    "target_sodium_mg": 2300, "target_alcohol_g": 0, "target_water_ml": 2500,
    "target_caffeine_mg": 400,
}


async def test_settings_router_updates_and_reads_goal_targets(async_client, auth_headers, test_user):
    body = {**_BASE, "target_weight_kg": 78.5, "target_body_fat_pct": 15.0}
    resp = await async_client.put("/api/v1/settings/nutrition-targets", json=body, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["target_weight_kg"] == 78.5
    assert data["target_body_fat_pct"] == 15.0

    get_resp = await async_client.get("/api/v1/settings", headers=auth_headers)
    nt = get_resp.json()["nutrition_targets"]
    assert nt["target_weight_kg"] == 78.5
    assert nt["target_body_fat_pct"] == 15.0


async def test_agent_router_updates_and_reads_goal_targets(async_client, api_key_headers):
    body = {**_BASE, "target_weight_kg": 80.0, "target_body_fat_pct": 12.5}
    resp = await async_client.put(
        "/api/agent/settings/nutrition-targets", json=body, headers=api_key_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["target_weight_kg"] == 80.0
    assert data["target_body_fat_pct"] == 12.5

    get_resp = await async_client.get("/api/agent/settings", headers=api_key_headers)
    nt = get_resp.json()["nutrition_targets"]
    assert nt["target_weight_kg"] == 80.0
    assert nt["target_body_fat_pct"] == 12.5


async def test_body_fat_pct_bounds_rejected(async_client, auth_headers, test_user):
    body = {**_BASE, "target_body_fat_pct": 150.0}
    resp = await async_client.put("/api/v1/settings/nutrition-targets", json=body, headers=auth_headers)
    assert resp.status_code == 422
