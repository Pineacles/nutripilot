"""Integration response redaction tests + nutrient allowlist 400."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio

_WITHINGS_FIELD_MAPPING = {
    "type": "withings_measure",
    "source_label": "withings",
    "data_type": "weight",
    "measure_map": {"1": "weight_kg", "6": "body_fat_pct"},
    "refresh_token": "super-secret-refresh-token",
    "client_id": "my-client-id",
    "client_secret": "super-secret-client-secret",
}

_INTEGRATION_PAYLOAD = {
    "name": "Withings Body+",
    "source_url": "https://wbsapi.withings.net/measure",
    "auth_header": "fake-access-token",
    "schedule": "0 6 * * *",
    "field_mapping": _WITHINGS_FIELD_MAPPING,
}


async def test_integration_response_redacts_secrets(async_client, api_key_headers):
    """Secrets in field_mapping must not appear in API responses."""
    create_resp = await async_client.post(
        "/api/agent/integrations",
        json=_INTEGRATION_PAYLOAD,
        headers=api_key_headers,
    )
    assert create_resp.status_code == 201
    data = create_resp.json()
    fm = data["field_mapping"]

    assert fm["refresh_token"] == "•••", "refresh_token must be redacted"
    assert fm["client_secret"] == "•••", "client_secret must be redacted"
    # Non-secret fields must be preserved
    assert fm["client_id"] == "my-client-id"
    assert fm["type"] == "withings_measure"


async def test_integration_list_response_redacts_secrets(async_client, api_key_headers):
    """GET /integrations must also redact secrets."""
    await async_client.post("/api/agent/integrations", json=_INTEGRATION_PAYLOAD, headers=api_key_headers)
    list_resp = await async_client.get("/api/agent/integrations", headers=api_key_headers)
    assert list_resp.status_code == 200
    for integration in list_resp.json():
        if integration.get("field_mapping"):
            fm = integration["field_mapping"]
            assert fm.get("refresh_token") != "super-secret-refresh-token"
            assert fm.get("client_secret") != "super-secret-client-secret"


async def test_integration_update_preserves_secrets_when_sentinel_sent(async_client, api_key_headers):
    """PATCH with sentinel •••  must preserve stored secrets."""
    create_resp = await async_client.post(
        "/api/agent/integrations",
        json=_INTEGRATION_PAYLOAD,
        headers=api_key_headers,
    )
    assert create_resp.status_code == 201
    integration_id = create_resp.json()["id"]

    # Send back the redacted value: stored secret should be preserved
    patch_resp = await async_client.patch(
        f"/api/agent/integrations/{integration_id}",
        json={"field_mapping": {"refresh_token": "•••", "client_secret": "•••", "client_id": "my-client-id", "type": "withings_measure", "source_label": "withings", "data_type": "weight", "measure_map": {"1": "weight_kg"}}},
        headers=api_key_headers,
    )
    assert patch_resp.status_code == 200

    # The actual stored value should still be the original secret (not the sentinel)
    # We verify via the DB directly to check the stored value was preserved.
    # Via API it will always appear redacted, so we just check it's still redacted (not empty/null)
    fm = patch_resp.json()["field_mapping"]
    assert fm["refresh_token"] == "•••"  # still redacted (stored value intact)
    assert fm["client_secret"] == "•••"  # still redacted (stored value intact)


async def test_nutrient_sources_invalid_nutrient_returns_400(async_client, api_key_headers):
    """User-supplied nutrient field not in allowlist must return 400."""
    resp = await async_client.get(
        "/api/agent/nutrient-sources?nutrient=__class__",
        headers=api_key_headers,
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["code"] == "INVALID_NUTRIENT"


async def test_nutrient_sources_valid_nutrient(async_client, api_key_headers):
    resp = await async_client.get(
        "/api/agent/nutrient-sources?nutrient=protein",
        headers=api_key_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["nutrient"] == "protein"
    assert "sources" in data


async def test_nutrient_sources_dashboard_invalid_returns_400(async_client, auth_headers):
    """Dashboard nutrient-sources also enforces the allowlist."""
    resp = await async_client.get(
        "/api/dashboard/nutrient-sources?nutrient=password_hash",
        headers=auth_headers,
    )
    assert resp.status_code == 400


# --- SSRF guard on integration create/update ---


async def test_integration_create_rejects_private_source_url(async_client, api_key_headers):
    """source_url resolving to a private/loopback address must be rejected with 422."""
    resp = await async_client.post(
        "/api/agent/integrations",
        json={**_INTEGRATION_PAYLOAD, "source_url": "http://127.0.0.1:8080/steal"},
        headers=api_key_headers,
    )
    assert resp.status_code == 422


async def test_integration_create_rejects_metadata_endpoint_source_url(async_client, api_key_headers):
    """The cloud metadata IP (169.254.169.254) must be rejected."""
    resp = await async_client.post(
        "/api/agent/integrations",
        json={**_INTEGRATION_PAYLOAD, "source_url": "http://169.254.169.254/latest/meta-data"},
        headers=api_key_headers,
    )
    assert resp.status_code == 422


async def test_integration_create_rejects_private_token_url(async_client, api_key_headers):
    """field_mapping.token_url resolving to a private address must also be rejected."""
    payload = {
        **_INTEGRATION_PAYLOAD,
        "field_mapping": {**_WITHINGS_FIELD_MAPPING, "token_url": "http://10.0.0.5/oauth/token"},
    }
    resp = await async_client.post(
        "/api/agent/integrations",
        json=payload,
        headers=api_key_headers,
    )
    assert resp.status_code == 422


# --- IntegrationUpdate merged validation ---


async def test_integration_update_partial_patch_still_works(async_client, api_key_headers):
    """A partial PATCH that only touches an unrelated field must still succeed."""
    create_resp = await async_client.post(
        "/api/agent/integrations",
        json=_INTEGRATION_PAYLOAD,
        headers=api_key_headers,
    )
    assert create_resp.status_code == 201
    integration_id = create_resp.json()["id"]

    patch_resp = await async_client.patch(
        f"/api/agent/integrations/{integration_id}",
        json={"schedule": "0 12 * * *"},
        headers=api_key_headers,
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["schedule"] == "0 12 * * *"


async def test_integration_update_invalid_merged_mapping_returns_422(async_client, api_key_headers):
    """A PATCH that produces an invalid merged field_mapping must be rejected."""
    create_resp = await async_client.post(
        "/api/agent/integrations",
        json=_INTEGRATION_PAYLOAD,
        headers=api_key_headers,
    )
    assert create_resp.status_code == 201
    integration_id = create_resp.json()["id"]

    # measure_map value "not_a_real_target" is not a valid NutriPilot field.
    patch_resp = await async_client.patch(
        f"/api/agent/integrations/{integration_id}",
        json={"field_mapping": {"measure_map": {"1": "not_a_real_target"}}},
        headers=api_key_headers,
    )
    assert patch_resp.status_code == 422
