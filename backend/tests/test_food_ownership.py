"""Food ownership: edit/delete rules, clone endpoint, created_by on create."""

from __future__ import annotations

import uuid

import pytest
from passlib.context import CryptContext
from sqlalchemy import select

from app.models.food import Food
from app.models.nutrient import Nutrient
from app.models.user import User

pytestmark = pytest.mark.asyncio

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

_FOOD_PAYLOAD = {
    "name": "Ownership Chicken",
    "nutrients": {"kcal": 165, "protein": 31.0, "carbs": 0.0, "fat": 3.6, "iron": 1.0},
}


async def _make_user_key(db_session) -> str:
    api_key = f"owner-key-{uuid.uuid4().hex}"
    user = User(
        id=uuid.uuid4(),
        email=f"owner-{uuid.uuid4().hex[:10]}@nutripilot.dev",
        password_hash=_pwd.hash("x"),
        api_key=api_key,
        target_kcal=2000, target_protein_g=150, target_carbs_g=250, target_fat_g=70,
        target_fiber_g=30, target_sugar_g=50, target_sodium_mg=2300,
        target_alcohol_g=0, target_water_ml=2500, target_caffeine_mg=400,
    )
    db_session.add(user)
    await db_session.commit()
    return api_key


async def test_create_food_sets_created_by(async_client, api_key_headers, test_user, db_session):
    resp = await async_client.post("/api/foods", json=_FOOD_PAYLOAD, headers=api_key_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["is_mine"] is True
    assert data["editable"] is True

    food = (await db_session.execute(select(Food).where(Food.id == uuid.UUID(data["id"])))).scalar_one()
    assert food.created_by == test_user.id


async def test_owner_can_update_own_food(async_client, api_key_headers):
    create = await async_client.post(
        "/api/foods", json={**_FOOD_PAYLOAD, "name": "Owner Edit Me"}, headers=api_key_headers
    )
    food_id = create.json()["id"]
    resp = await async_client.put(
        f"/api/foods/{food_id}", json={"name": "Owner Edited"}, headers=api_key_headers
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Owner Edited"


async def test_other_user_cannot_edit_food_403_not_owner(async_client, api_key_headers, db_session):
    create = await async_client.post(
        "/api/foods", json={**_FOOD_PAYLOAD, "name": "Not Yours"}, headers=api_key_headers
    )
    food_id = create.json()["id"]

    other_key = await _make_user_key(db_session)
    resp = await async_client.put(
        f"/api/foods/{food_id}", json={"name": "Hijack"}, headers={"X-API-Key": other_key}
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["code"] == "NOT_FOOD_OWNER"


async def test_official_food_is_read_only_403(async_client, api_key_headers, db_session):
    """A food with created_by IS NULL (official/curated) cannot be edited."""
    official = Food(id=uuid.uuid4(), name="Official Curated Food", source="swiss_db", created_by=None)
    db_session.add(official)
    await db_session.flush()
    db_session.add(Nutrient(food_id=official.id, kcal=100, protein=5))
    await db_session.commit()

    resp = await async_client.put(
        f"/api/foods/{official.id}", json={"name": "Tamper"}, headers=api_key_headers
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["code"] == "FOOD_READ_ONLY"

    del_resp = await async_client.delete(f"/api/foods/{official.id}", headers=api_key_headers)
    assert del_resp.status_code == 403
    assert del_resp.json()["detail"]["code"] == "FOOD_READ_ONLY"


async def test_clone_official_food_produces_owned_editable_copy(async_client, api_key_headers, test_user, db_session):
    official = Food(
        id=uuid.uuid4(), name="Swiss Emmentaler", source="swiss_db", created_by=None,
        serving_size_g=30, serving_label="1 slice",
    )
    db_session.add(official)
    await db_session.flush()
    db_session.add(Nutrient(food_id=official.id, kcal=380, protein=28, fat=30, calcium=1000))
    await db_session.commit()

    resp = await async_client.post(f"/api/foods/{official.id}/clone", headers=api_key_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Swiss Emmentaler (custom)"
    assert data["is_mine"] is True
    assert data["editable"] is True
    assert data["source"] == "manual"
    # Nutrient values copied.
    assert data["nutrients"]["kcal"] == 380
    assert data["nutrients"]["calcium"] == 1000
    # Serving info copied.
    assert data["serving_size_g"] == 30

    clone_id = uuid.UUID(data["id"])
    clone = (await db_session.execute(select(Food).where(Food.id == clone_id))).scalar_one()
    assert clone.created_by == test_user.id
    assert clone.barcode is None  # unique barcode not copied

    # The owner can now edit the clone.
    edit = await async_client.put(
        f"/api/foods/{clone_id}", json={"name": "My Emmentaler"}, headers=api_key_headers
    )
    assert edit.status_code == 200


async def test_clone_with_custom_name(async_client, api_key_headers):
    create = await async_client.post(
        "/api/foods", json={**_FOOD_PAYLOAD, "name": "Base Food"}, headers=api_key_headers
    )
    food_id = create.json()["id"]
    resp = await async_client.post(
        f"/api/foods/{food_id}/clone", json={"name": "Renamed Clone"}, headers=api_key_headers
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "Renamed Clone"


async def test_clone_missing_food_404(async_client, api_key_headers):
    resp = await async_client.post(f"/api/foods/{uuid.uuid4()}/clone", headers=api_key_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"]["code"] == "FOOD_NOT_FOUND"
