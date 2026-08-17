"""Tests for the food correction endpoint (PATCH /api/foods/barcode/{barcode}/correction)."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select

from app.models.food import Food
from app.models.nutrient import Nutrient

pytestmark = pytest.mark.asyncio


async def _create_official_barcode_food(db_session, barcode: str, name: str = "Official Barcoded Food") -> Food:
    """Create a food with created_by=None (official) and a barcode, plus a nutrient row."""
    food = Food(
        id=uuid.uuid4(),
        name=name,
        barcode=barcode,
        source="openfoodfacts",
        created_by=None,
        serving_size_g=100,
    )
    db_session.add(food)
    await db_session.flush()
    db_session.add(Nutrient(food_id=food.id, kcal=200, protein=10.0, carbs=20.0, fat=10.0))
    await db_session.commit()
    await db_session.refresh(food)
    return food


async def test_correct_official_food_serving_and_nutrient(
    async_client, auth_headers, db_session
):
    barcode = "1234567890123"
    food = await _create_official_barcode_food(db_session, barcode)

    resp = await async_client.patch(
        f"/api/foods/barcode/{barcode}/correction",
        json={
            "serving_size_g": 50,
            "nutrients": {"kcal": 150.0},
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["serving_size_g"] == 50
    assert data["nutrients"]["kcal"] == 150.0

    # Verify persistence
    await db_session.refresh(food)
    assert food.serving_size_g == 50
    assert food.corrected_at is not None
    assert food.corrected_by is not None

    nutrient = (
        await db_session.execute(select(Nutrient).where(Nutrient.food_id == food.id))
    ).scalar_one()
    assert nutrient.kcal == 150.0


async def test_corrected_values_returned_by_barcode_get(
    async_client, auth_headers, db_session
):
    barcode = "9876543210987"
    await _create_official_barcode_food(db_session, barcode)

    # Apply correction
    await async_client.patch(
        f"/api/foods/barcode/{barcode}/correction",
        json={"serving_size_g": 30, "name": "Corrected Name"},
        headers=auth_headers,
    )

    # Subsequent GET should return corrected values
    resp = await async_client.get(f"/api/foods/barcode/{barcode}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["serving_size_g"] == 30
    assert data["name"] == "Corrected Name"


async def test_correct_unknown_barcode_404(async_client, auth_headers):
    resp = await async_client.patch(
        "/api/foods/barcode/0000000000000/correction",
        json={"serving_size_g": 50},
        headers=auth_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["detail"]["code"] == "FOOD_NOT_FOUND"


async def test_correct_empty_body_422(async_client, auth_headers, db_session):
    barcode = "5555555555555"
    await _create_official_barcode_food(db_session, barcode)

    resp = await async_client.patch(
        f"/api/foods/barcode/{barcode}/correction",
        json={},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_correct_unauthenticated_401(async_client, db_session):
    barcode = "4444444444444"
    await _create_official_barcode_food(db_session, barcode)

    resp = await async_client.patch(
        f"/api/foods/barcode/{barcode}/correction",
        json={"serving_size_g": 50},
    )
    assert resp.status_code == 401


async def test_generic_put_on_official_food_still_403(
    async_client, auth_headers, db_session
):
    """Regression guard: generic PUT /api/foods/{id} on official food must still be 403."""
    barcode = "3333333333333"
    food = await _create_official_barcode_food(db_session, barcode)

    resp = await async_client.put(
        f"/api/foods/{food.id}",
        json={"name": "Tampered"},
        headers=auth_headers,
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["code"] == "FOOD_READ_ONLY"
