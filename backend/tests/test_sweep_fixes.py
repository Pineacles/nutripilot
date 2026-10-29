"""Fixes from the database/API sweep: deletes, conflicts, nulls, dates, weights, barcodes."""

from __future__ import annotations

import uuid

import pytest

from app.services.barcode_service import barcode_problem, check_digit_ok
from tests.test_food_ownership import _make_user_key

pytestmark = pytest.mark.asyncio


async def _food(client, headers, **extra):
    resp = await client.post(
        "/api/foods", json={"name": f"Sweep {uuid.uuid4().hex[:6]}", "nutrients": {"kcal": 100}, **extra}, headers=headers
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_owner_can_delete_unused_food(async_client, api_key_headers):
    food = await _food(async_client, api_key_headers)
    resp = await async_client.delete(f"/api/foods/{food['id']}", headers=api_key_headers)
    assert resp.status_code == 204
    assert (await async_client.delete(f"/api/foods/{food['id']}", headers=api_key_headers)).status_code == 404


async def test_taken_barcode_is_409(async_client, api_key_headers):
    await _food(async_client, api_key_headers, barcode="7610000000017")
    resp = await async_client.post(
        "/api/foods", json={"name": "Twin", "barcode": "7610000000017", "nutrients": {"kcal": 1}}, headers=api_key_headers
    )
    assert resp.status_code == 409 and resp.json()["detail"]["code"] == "BARCODE_EXISTS"
    other = await _food(async_client, api_key_headers)
    resp = await async_client.put(f"/api/foods/{other['id']}", json={"barcode": "7610000000017"}, headers=api_key_headers)
    assert resp.status_code == 409


async def test_correction_of_someone_elses_food_is_refused(async_client, api_key_headers, db_session):
    other_key = await _make_user_key(db_session)
    await _food(async_client, {"X-API-Key": other_key}, barcode="7610000000024")
    resp = await async_client.patch(
        "/api/foods/barcode/7610000000024/correction", json={"name": "Hijacked"}, headers=api_key_headers
    )
    assert resp.status_code == 403


async def test_explicit_nulls_and_wild_dates_are_422(async_client, api_key_headers):
    food = await _food(async_client, api_key_headers)
    resp = await async_client.post(
        "/api/agent/log/food",
        json={"food_id": food["id"], "quantity_g": 50, "meal_type": "lunch", "date": "2024-05-01"},
        headers=api_key_headers,
    )
    log_id = resp.json()["id"]
    for body in ({"meal_type": None}, {"date": None}, {"quantity_g": None}, {"date": "9999-12-31"}):
        resp = await async_client.put(f"/api/agent/log/food/{log_id}", json=body, headers=api_key_headers)
        assert resp.status_code == 422, body
    resp = await async_client.post(
        "/api/agent/log/food",
        json={"food_id": food["id"], "quantity_g": 50, "meal_type": "lunch", "date": "0001-01-01"},
        headers=api_key_headers,
    )
    assert resp.status_code == 422
    resp = await async_client.post(
        "/api/agent/log/food/copy", json={"from_date": "2024-05-01", "to_date": "9999-01-01"}, headers=api_key_headers
    )
    assert resp.status_code == 422


async def test_weight_update_keeps_kg_and_percent_together(async_client, api_key_headers):
    resp = await async_client.post(
        "/api/agent/log/weight", json={"weight_kg": 80, "body_fat_pct": 20, "date": "2024-05-02"}, headers=api_key_headers
    )
    log_id = resp.json()["id"]
    resp = await async_client.put(f"/api/agent/log/weight/{log_id}", json={"body_fat_pct": 30}, headers=api_key_headers)
    assert resp.status_code == 200
    assert resp.json()["body_fat_kg"] == 24.0
    # A new weight keeps the percentage and moves the kilos.
    resp = await async_client.put(f"/api/agent/log/weight/{log_id}", json={"weight_kg": 70}, headers=api_key_headers)
    assert resp.json()["body_fat_pct"] == 30 and resp.json()["body_fat_kg"] == 21.0
    resp = await async_client.put(f"/api/agent/log/weight/{log_id}", json={"weight_kg": None}, headers=api_key_headers)
    assert resp.status_code == 422


async def test_long_strings_are_422_not_500(async_client, api_key_headers):
    resp = await async_client.post(
        "/api/agent/log/weight", json={"weight_kg": 80, "source": "x" * 30}, headers=api_key_headers
    )
    assert resp.status_code == 422
    resp = await async_client.put(
        "/api/agent/settings/micronutrient-targets",
        json={"targets": [{"nutrient": "iron", "target_value": 10, "unit": "mg"}] * 2},
        headers=api_key_headers,
    )
    assert resp.status_code == 422


async def test_weight_upsert_repairs_a_doubled_day(db_session, test_user):
    from datetime import date

    from sqlalchemy import select

    from app.models.weight_log import WeightLog
    from app.services.logging_service import upsert_weight

    day = date(2024, 5, 3)
    for kg in (90.0, 90.0):
        db_session.add(WeightLog(user_id=test_user.id, weight_kg=kg, source="withings", date=day))
    await db_session.commit()
    await upsert_weight(db_session, test_user.id, 89.5, source="withings", log_date=day)
    rows = (await db_session.execute(
        select(WeightLog).where(WeightLog.user_id == test_user.id, WeightLog.date == day)
    )).scalars().all()
    assert [r.weight_kg for r in rows] == [89.5]


def test_barcode_checks():
    assert check_digit_ok("7610200337429")  # a Swiss EAN-13
    assert not check_digit_ok("7610200337425")
    assert check_digit_ok("036000291452")  # UPC-A
    assert check_digit_ok("04252614")  # UPC-E of 042100005264
    assert not check_digit_ok("04252615")
    assert barcode_problem("2112345012345") == "store_label"  # Migros/Coop counter label
    assert barcode_problem("7610200337425") == "misread"
    assert barcode_problem("7610200337429") is None
    assert barcode_problem("ABC-123") is None  # not a retail code: just look it up


async def test_blank_imported_food_is_looked_up_again(db_session, monkeypatch):
    from app.external import openfoodfacts
    from app.schemas.food import NutrientData
    from app.services import barcode_service
    from app.services.food_service import create_food_from_external

    code = "7640151718060"
    await create_food_from_external(db_session, "Millionaire's Dream (Chiefs)", code, "openfoodfacts", NutrientData())

    async def label_added_since(barcode):
        return "Millionaire's Dream (Chiefs)", NutrientData(kcal=84, protein=10, carbs=7, fat=2.3), 200, "1 cup"

    monkeypatch.setattr(openfoodfacts, "lookup_barcode", label_added_since)
    food = await barcode_service.lookup_barcode(db_session, code)
    assert food.nutrients.kcal == 84 and food.serving_size_g == 200

    # Values someone typed in are never overwritten by a later lookup.
    food.nutrients.kcal = None
    food.corrected_at = __import__("datetime").datetime.now()
    await db_session.commit()
    food = await barcode_service.lookup_barcode(db_session, code)
    assert food.nutrients.kcal is None


async def test_cached_food_with_contradicting_calories_is_looked_up_again(db_session, monkeypatch):
    from app.external import openfoodfacts
    from app.schemas.food import NutrientData
    from app.services import barcode_service
    from app.services.food_service import create_food_from_external

    code = "7624841902908"
    await create_food_from_external(
        db_session, "Poulet delice 2pces", code, "openfoodfacts", NutrientData(kcal=148, protein=14, carbs=12, fat=13)
    )
    fixed = NutrientData(kcal=221.8, protein=14, carbs=12, fat=13)

    async def lookup(barcode):
        return "Poulet delice 2pces", fixed, 150, "1 piece (150 g)"

    monkeypatch.setattr(openfoodfacts, "lookup_barcode", lookup)
    food = await barcode_service.lookup_barcode(db_session, code)
    assert round(food.nutrients.kcal) == 222 and food.serving_size_g == 150

    # Plausible values are not fetched again on every scan.
    async def unexpected(barcode):
        raise AssertionError("looked up a food whose values add up")

    monkeypatch.setattr(openfoodfacts, "lookup_barcode", unexpected)
    await barcode_service.lookup_barcode(db_session, code)


async def test_barcode_spacing_does_not_make_a_twin(async_client, api_key_headers):
    first = await _food(async_client, api_key_headers, barcode="7610000000031")
    resp = await async_client.post(
        "/api/foods", json={"name": "Twin", "barcode": "7 610000 000031", "nutrients": {"kcal": 1}}, headers=api_key_headers
    )
    assert resp.status_code == 409 and resp.json()["detail"]["code"] == "BARCODE_EXISTS"
    created = await _food(async_client, api_key_headers, barcode="7610 000000048")
    assert created["barcode"] == "7610000000048"
    assert first["barcode"] == "7610000000031"


def test_gs1_scan_reads_counter_label_datamatrix():
    from app.services.barcode_service import gs1_scan

    gs = "\x1d"
    # Coop Willisau roastbeef label, read from the photo with zxing.
    raw = "0107610819523015101970143261024" + gs + "15261027172610273103000162" + "3922905" + gs + "9340"
    assert gs1_scan(raw) == ("7610819523015", 162.0)
    assert gs1_scan("]d2" + raw) == ("7610819523015", 162.0)
    assert gs1_scan("(01)07610819523015(10)197014(3103)000162") == ("7610819523015", 162.0)
    assert gs1_scan("https://id.gs1.org/01/07610819523015?3103=000162") == ("7610819523015", 162.0)
    assert gs1_scan("0107610819523015") == ("7610819523015", None)
    assert gs1_scan("7610819523015") is None  # a plain EAN


def test_gs1_scan_reads_coop_markdown_sticker():
    from app.services.barcode_service import gs1_scan

    # Coop "Verwenden statt Verschwenden" Code 128 on a Tiramisu Cup, read from the photo with zxing:
    # 27 + EAN-13 + one digit + price in centimes (2.00).
    assert gs1_scan("277627535898389400000200") == ("7627535898389", None)
    assert gs1_scan(" 277627535898389400000200 ") == ("7627535898389", None)
    assert gs1_scan("27762753589838940000020") is None  # one digit short
    assert gs1_scan("287627535898389400000200") is None
    assert gs1_scan("https://coop.ch/promo") is None


async def test_log_by_gs1_code_uses_pack_weight(async_client, api_key_headers):
    await _food(async_client, api_key_headers, barcode="7610819523015")
    raw = "0107610819523015101970143261024\x1d15261027172610273103000162"
    resp = await async_client.post(
        "/api/agent/log/food-by-barcode", json={"barcode": raw, "meal_type": "dinner", "date": "2003-01-05"}, headers=api_key_headers
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["quantity_g"] == 162
    # An amount given explicitly still wins.
    resp = await async_client.post(
        "/api/agent/log/food-by-barcode",
        json={"barcode": "(01)07610819523015(3103)000162", "quantity_g": 80, "meal_type": "dinner", "date": "2003-01-05"},
        headers=api_key_headers,
    )
    assert resp.json()["quantity_g"] == 80
