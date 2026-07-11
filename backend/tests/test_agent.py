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


# --- Weight log "move day" guard: only manual entries can have their date changed ---


async def test_weight_log_manual_date_change_allowed(async_client, api_key_headers):
    create_resp = await async_client.post(
        "/api/agent/log/weight",
        json={"weight_kg": 80.0, "source": "manual", "date": "2026-07-01"},
        headers=api_key_headers,
    )
    assert create_resp.status_code == 201
    log_id = create_resp.json()["id"]

    patch_resp = await async_client.put(
        f"/api/agent/log/weight/{log_id}",
        json={"log_date": "2026-07-02"},
        headers=api_key_headers,
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["date"] == "2026-07-02"


async def test_weight_log_synced_date_change_rejected(async_client, api_key_headers):
    create_resp = await async_client.post(
        "/api/agent/log/weight",
        json={"weight_kg": 81.0, "source": "withings", "date": "2026-07-01"},
        headers=api_key_headers,
    )
    assert create_resp.status_code == 201
    log_id = create_resp.json()["id"]

    patch_resp = await async_client.put(
        f"/api/agent/log/weight/{log_id}",
        json={"log_date": "2026-07-02"},
        headers=api_key_headers,
    )
    assert patch_resp.status_code == 422
    assert patch_resp.json()["detail"]["detail"] == "date of synced entries cannot be changed"

    # The date must remain unchanged.
    list_resp = await async_client.get(
        "/api/agent/log/weight?source=withings",
        headers=api_key_headers,
    )
    assert any(w["date"] == "2026-07-01" for w in list_resp.json())
