"""Cross-user isolation (IDOR) coverage.

Every per-user entity must be scoped to its owner: another user must get a 404
(never a silent success) on PUT/DELETE by id (and GET-by-id where such a route
exists), and every list endpoint must never leak another user's rows. A
settings update by one user must never affect another user's settings.

Exercised across both auth modes: user A authenticates with a JWT, user B
with an API key — proving the scoping is enforced at the query layer (every
router filters by ``user.id``), not as a side effect of one particular auth
dependency.
"""

from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from passlib.context import CryptContext

from app.models.user import User

pytestmark = pytest.mark.asyncio

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
_PASSWORD_B = "user-b-password-456"

_FOOD_PAYLOAD = {
    "name": "Isolation Chicken",
    "nutrients": {"kcal": 165, "protein": 31.0, "carbs": 0.0, "fat": 3.6},
}


@pytest_asyncio.fixture()
async def user_b(db_session) -> User:
    """A second, independent user — B — to attempt cross-user access as."""
    user = User(
        id=uuid.uuid4(),
        email=f"userb-{uuid.uuid4().hex[:10]}@nutripilot.dev",
        password_hash=_pwd.hash(_PASSWORD_B),
        api_key=f"userb-key-{uuid.uuid4().hex}",
        target_kcal=1800,
        target_protein_g=120,
        target_carbs_g=200,
        target_fat_g=60,
        target_fiber_g=25,
        target_sugar_g=40,
        target_sodium_mg=2000,
        target_alcohol_g=0,
        target_water_ml=2000,
        target_caffeine_mg=300,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture()
async def b_headers(user_b) -> dict:
    """User B's auth — API key (user A uses JWT via the shared ``auth_headers`` fixture)."""
    return {"X-API-Key": user_b.api_key}


@pytest_asyncio.fixture()
async def b_jwt_headers(user_b, async_client) -> dict:
    """User B's JWT, used only where a test needs both users on the same auth mode."""
    resp = await async_client.post(
        "/api/auth/login", json={"email": user_b.email, "password": _PASSWORD_B}
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Food logs
# ---------------------------------------------------------------------------


async def test_food_log_isolation(async_client, auth_headers, b_headers):
    food_resp = await async_client.post("/api/foods", json=_FOOD_PAYLOAD, headers=auth_headers)
    assert food_resp.status_code == 201
    food_id = food_resp.json()["id"]

    log_resp = await async_client.post(
        "/api/agent/log/food",
        json={"food_id": food_id, "quantity_g": 100, "meal_type": "lunch"},
        headers=auth_headers,
    )
    assert log_resp.status_code == 201
    log_id = log_resp.json()["id"]
    day = log_resp.json()["date"]

    # B cannot update or delete A's food log.
    assert (
        await async_client.put(
            f"/api/agent/log/food/{log_id}", json={"quantity_g": 200}, headers=b_headers
        )
    ).status_code == 404
    assert (
        await async_client.delete(f"/api/agent/log/food/{log_id}", headers=b_headers)
    ).status_code == 404

    # B's list for that day never contains A's entry.
    b_list = await async_client.get(f"/api/agent/log/food?day={day}", headers=b_headers)
    assert b_list.status_code == 200
    assert all(e["id"] != log_id for e in b_list.json()["entries"])

    # A's own log is untouched and still reachable (proves the 404s above were
    # ownership checks, not a broken route).
    a_list = await async_client.get(f"/api/agent/log/food?day={day}", headers=auth_headers)
    assert any(e["id"] == log_id for e in a_list.json()["entries"])


# ---------------------------------------------------------------------------
# Weight logs
# ---------------------------------------------------------------------------


async def test_weight_log_isolation(async_client, auth_headers, b_headers):
    create = await async_client.post(
        "/api/agent/log/weight", json={"weight_kg": 80.0, "source": "manual"}, headers=auth_headers
    )
    assert create.status_code == 201
    log_id = create.json()["id"]

    assert (
        await async_client.put(
            f"/api/agent/log/weight/{log_id}", json={"weight_kg": 90.0}, headers=b_headers
        )
    ).status_code == 404
    assert (
        await async_client.delete(f"/api/agent/log/weight/{log_id}", headers=b_headers)
    ).status_code == 404

    b_list = await async_client.get("/api/agent/log/weight", headers=b_headers)
    assert b_list.status_code == 200
    assert all(w["id"] != log_id for w in b_list.json())

    a_list = await async_client.get("/api/agent/log/weight", headers=auth_headers)
    assert any(w["id"] == log_id for w in a_list.json())


# ---------------------------------------------------------------------------
# Water logs
# ---------------------------------------------------------------------------


async def test_water_log_isolation(async_client, auth_headers, b_headers):
    create = await async_client.post(
        "/api/agent/log/water", json={"amount_ml": 250}, headers=auth_headers
    )
    assert create.status_code == 201
    log_id = create.json()["id"]
    day = create.json()["date"]

    assert (
        await async_client.put(
            f"/api/agent/log/water/{log_id}", json={"amount_ml": 500}, headers=b_headers
        )
    ).status_code == 404
    assert (
        await async_client.delete(f"/api/agent/log/water/{log_id}", headers=b_headers)
    ).status_code == 404

    b_list = await async_client.get(f"/api/agent/log/water?day={day}", headers=b_headers)
    assert b_list.status_code == 200
    assert all(w["id"] != log_id for w in b_list.json())


# ---------------------------------------------------------------------------
# Caffeine logs (deprecated endpoint, still routed)
# ---------------------------------------------------------------------------


async def test_caffeine_log_isolation(async_client, auth_headers, b_headers):
    create = await async_client.post(
        "/api/agent/log/caffeine", json={"amount_mg": 80}, headers=auth_headers
    )
    assert create.status_code == 201
    log_id = create.json()["id"]
    day = create.json()["date"]

    assert (
        await async_client.put(
            f"/api/agent/log/caffeine/{log_id}", json={"amount_mg": 120}, headers=b_headers
        )
    ).status_code == 404
    assert (
        await async_client.delete(f"/api/agent/log/caffeine/{log_id}", headers=b_headers)
    ).status_code == 404

    b_list = await async_client.get(f"/api/agent/log/caffeine?day={day}", headers=b_headers)
    assert b_list.status_code == 200
    assert all(c["id"] != log_id for c in b_list.json())


# ---------------------------------------------------------------------------
# Supplement logs
# ---------------------------------------------------------------------------


async def test_supplement_log_isolation(async_client, auth_headers, b_headers):
    create = await async_client.post(
        "/api/agent/log/supplement",
        json={"name": "Vitamin D3", "dose_amount": 4000, "dose_unit": "IU"},
        headers=auth_headers,
    )
    assert create.status_code == 201
    log_id = create.json()["id"]
    day = create.json()["date"]

    assert (
        await async_client.put(
            f"/api/agent/log/supplement/{log_id}", json={"dose_amount": 2000}, headers=b_headers
        )
    ).status_code == 404
    assert (
        await async_client.delete(f"/api/agent/log/supplement/{log_id}", headers=b_headers)
    ).status_code == 404

    b_list = await async_client.get(f"/api/agent/log/supplement?day={day}", headers=b_headers)
    assert b_list.status_code == 200
    assert all(s["id"] != log_id for s in b_list.json())


# ---------------------------------------------------------------------------
# Supplement definitions
# ---------------------------------------------------------------------------


async def test_supplement_definition_isolation(async_client, auth_headers, b_headers):
    create = await async_client.post(
        "/api/agent/supplements",
        json={"name": "Omega-3", "dose_amount": 1000, "dose_unit": "mg"},
        headers=auth_headers,
    )
    assert create.status_code == 201
    supp_id = create.json()["id"]

    assert (
        await async_client.put(
            f"/api/agent/supplements/{supp_id}", json={"dose_amount": 2000}, headers=b_headers
        )
    ).status_code == 404
    assert (
        await async_client.delete(f"/api/agent/supplements/{supp_id}", headers=b_headers)
    ).status_code == 404

    b_list = await async_client.get("/api/agent/supplements", headers=b_headers)
    assert b_list.status_code == 200
    assert all(s["id"] != supp_id for s in b_list.json())

    a_list = await async_client.get("/api/agent/supplements", headers=auth_headers)
    assert any(s["id"] == supp_id for s in a_list.json())


# ---------------------------------------------------------------------------
# Micronutrient targets + nutrition targets (bulk-replace, no per-row id route)
# ---------------------------------------------------------------------------


def _targets_body(**overrides) -> dict:
    body = {
        "target_kcal": 2000, "target_protein_g": 150, "target_carbs_g": 250,
        "target_fat_g": 70, "target_fiber_g": 30, "target_sugar_g": 50,
        "target_sodium_mg": 2300, "target_alcohol_g": 0, "target_water_ml": 2500,
        "target_caffeine_mg": 400,
    }
    body.update(overrides)
    return body


async def test_micronutrient_targets_isolation(async_client, auth_headers, b_headers):
    a_put = await async_client.put(
        "/api/agent/settings/micronutrient-targets",
        json={"targets": [{"nutrient": "calcium", "target_value": 1000, "unit": "mg"}]},
        headers=auth_headers,
    )
    assert a_put.status_code == 200

    b_put = await async_client.put(
        "/api/agent/settings/micronutrient-targets",
        json={"targets": [{"nutrient": "zinc", "target_value": 15, "unit": "mg"}]},
        headers=b_headers,
    )
    assert b_put.status_code == 200

    a_settings = await async_client.get("/api/agent/settings", headers=auth_headers)
    a_nutrients = {t["nutrient"] for t in a_settings.json()["micronutrient_targets"]}
    assert a_nutrients == {"calcium"}

    b_settings = await async_client.get("/api/agent/settings", headers=b_headers)
    b_nutrients = {t["nutrient"] for t in b_settings.json()["micronutrient_targets"]}
    assert b_nutrients == {"zinc"}


async def test_settings_update_does_not_affect_other_user(async_client, auth_headers, b_headers):
    """B updating its nutrition targets must not change A's stored targets."""
    a_before = await async_client.get("/api/agent/settings", headers=auth_headers)
    a_kcal_before = a_before.json()["nutrition_targets"]["target_kcal"]

    b_update = await async_client.put(
        "/api/agent/settings/nutrition-targets",
        json=_targets_body(target_kcal=3333),
        headers=b_headers,
    )
    assert b_update.status_code == 200
    assert b_update.json()["target_kcal"] == 3333

    a_after = await async_client.get("/api/agent/settings", headers=auth_headers)
    assert a_after.json()["nutrition_targets"]["target_kcal"] == a_kcal_before
    assert a_after.json()["nutrition_targets"]["target_kcal"] != 3333


# ---------------------------------------------------------------------------
# Integrations
# ---------------------------------------------------------------------------


_INTEGRATION_PAYLOAD = {
    "name": "Isolation Withings",
    "source_url": "https://wbsapi.withings.net/measure",
    "auth_header": "fake-access-token",
    "schedule": "0 6 * * *",
    "field_mapping": {
        "type": "withings_measure",
        "source_label": "withings",
        "data_type": "weight",
        "measure_map": {"1": "weight_kg"},
        "refresh_token": "refresh-xyz",
        "client_id": "client-id",
        "client_secret": "client-secret",
    },
}


async def test_integration_isolation(async_client, auth_headers, b_headers):
    create = await async_client.post(
        "/api/agent/integrations", json=_INTEGRATION_PAYLOAD, headers=auth_headers
    )
    assert create.status_code == 201
    integ_id = create.json()["id"]

    assert (
        await async_client.patch(
            f"/api/agent/integrations/{integ_id}", json={"schedule": "0 12 * * *"}, headers=b_headers
        )
    ).status_code == 404
    assert (
        await async_client.post(f"/api/agent/integrations/{integ_id}/sync", headers=b_headers)
    ).status_code == 404
    assert (
        await async_client.delete(f"/api/agent/integrations/{integ_id}", headers=b_headers)
    ).status_code == 404

    b_list = await async_client.get("/api/agent/integrations", headers=b_headers)
    assert b_list.status_code == 200
    assert all(i["id"] != integ_id for i in b_list.json())

    a_list = await async_client.get("/api/agent/integrations", headers=auth_headers)
    assert any(i["id"] == integ_id for i in a_list.json())


# ---------------------------------------------------------------------------
# Cross-check: same scenario, but both users on the *other* auth mode, to
# prove isolation isn't an artifact of mixing JWT + API key specifically.
# ---------------------------------------------------------------------------


async def test_weight_log_isolation_both_users_jwt(async_client, auth_headers, b_jwt_headers):
    create = await async_client.post(
        "/api/agent/log/weight", json={"weight_kg": 65.0, "source": "manual"}, headers=auth_headers
    )
    assert create.status_code == 201
    log_id = create.json()["id"]

    assert (
        await async_client.put(
            f"/api/agent/log/weight/{log_id}", json={"weight_kg": 70.0}, headers=b_jwt_headers
        )
    ).status_code == 404
    assert (
        await async_client.delete(f"/api/agent/log/weight/{log_id}", headers=b_jwt_headers)
    ).status_code == 404
