"""Agent coaching additions: body profile, private foods, dishes, progress math, food detail."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
import pytest_asyncio
from passlib.context import CryptContext

from app.auth.api_keys import api_key_fields
from app.models.user import User
from app.services import progress_service as ps
from app.services.clock import today_for

pytestmark = pytest.mark.asyncio

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


@pytest_asyncio.fixture()
async def b_headers(db_session) -> dict:
    key = f"coach-b-{uuid.uuid4().hex}"
    user = User(
        id=uuid.uuid4(), email=f"coachb-{uuid.uuid4().hex[:10]}@nutripilot.dev", password_hash=_pwd.hash("x"),
        **api_key_fields(key), target_kcal=1800, target_protein_g=120, target_carbs_g=200, target_fat_g=60,
        target_fiber_g=25, target_sugar_g=40, target_sodium_mg=2000, target_alcohol_g=0,
        target_water_ml=2000, target_caffeine_mg=300,
    )
    db_session.add(user)
    await db_session.commit()
    return {"X-API-Key": key}


async def _food(client, headers, name, kcal, protein=0.0, **extra):
    resp = await client.post(
        "/api/foods", json={"name": f"{name}-{uuid.uuid4().hex[:6]}", "nutrients": {"kcal": kcal, "protein": protein}, **extra},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------- profile


async def test_profile_defaults_and_partial_update(async_client, api_key_headers):
    got = (await async_client.get("/api/agent/profile", headers=api_key_headers)).json()
    assert got["height_cm"] is None and got["sex"] is None
    assert got["target_kcal"] == 2000 and got["timezone"] == "Europe/Zurich"
    assert {"target_protein_g", "target_weight_kg", "target_body_fat_pct"} <= set(got)

    resp = await async_client.put("/api/agent/profile", json={"height_cm": 180, "sex": "male"}, headers=api_key_headers)
    assert resp.status_code == 200
    resp = await async_client.put("/api/agent/profile", json={"birth_year": 1990}, headers=api_key_headers)
    data = resp.json()
    assert (data["height_cm"], data["sex"], data["birth_year"], data["activity_level"]) == (180, "male", 1990, None)


@pytest.mark.parametrize("body", [
    {"height_cm": 99}, {"height_cm": 251}, {"birth_year": 1899}, {"birth_year": date.today().year - 9},
    {"sex": "other"}, {"activity_level": "extreme"},
])
async def test_profile_validation(async_client, api_key_headers, body):
    assert (await async_client.put("/api/agent/profile", json=body, headers=api_key_headers)).status_code == 422


async def test_profile_birth_year_bounds_accepted(async_client, api_key_headers):
    for year in (1900, date.today().year - 10):
        resp = await async_client.put("/api/agent/profile", json={"birth_year": year}, headers=api_key_headers)
        assert resp.status_code == 200


# ---------------------------------------------------------------- private foods


async def test_private_flag_and_source(async_client, api_key_headers):
    food = await _food(async_client, api_key_headers, "Estimate", 120, private=True, source="ai_estimate")
    assert food["private"] is True and food["source"] == "ai_estimate"
    plain = await _food(async_client, api_key_headers, "Plain", 100)
    assert plain["private"] is False and plain["source"] == "manual"
    bad = await async_client.post(
        "/api/foods", json={"name": "x", "source": "usda", "nutrients": {"kcal": 1}}, headers=api_key_headers
    )
    assert bad.status_code == 422


async def test_private_food_invisible_to_other_user(async_client, api_key_headers, b_headers):
    name = f"Secret{uuid.uuid4().hex[:8]}"
    food = (await async_client.post(
        "/api/foods", json={"name": name, "private": True, "nutrients": {"kcal": 100}},
        headers=api_key_headers,
    )).json()
    fid = food["id"]

    # owner sees it
    assert any(r["id"] == fid for r in (await async_client.get(f"/api/foods/search?q={name}", headers=api_key_headers)).json())
    assert (await async_client.get(f"/api/foods/{fid}", headers=api_key_headers)).status_code == 200

    # other user: search, detail, log, clone, servings, update, delete, by-name, barcode
    assert not any(r["id"] == fid for r in (await async_client.get(f"/api/foods/search?q={name}", headers=b_headers)).json())
    for resp in (
        await async_client.get(f"/api/foods/{fid}", headers=b_headers),
        await async_client.post("/api/agent/log/food", json={"food_id": fid, "servings": 1, "meal_type": "lunch"}, headers=b_headers),
        await async_client.post(f"/api/foods/{fid}/clone", headers=b_headers),
        await async_client.post(f"/api/foods/{fid}/servings", json={"label": "bit", "grams": 5}, headers=b_headers),
        await async_client.put(f"/api/foods/{fid}", json={"name": "mine"}, headers=b_headers),
        await async_client.delete(f"/api/foods/{fid}", headers=b_headers),
    ):
        assert resp.status_code == 404, resp.text
        assert resp.json()["detail"]["code"] == "FOOD_NOT_FOUND"
    by_name = await async_client.post(
        "/api/agent/log/food-by-name", json={"food_name": name, "servings": 1, "meal_type": "lunch"}, headers=b_headers
    )
    assert by_name.status_code == 404
    assert by_name.json()["detail"]["code"] == "FOOD_NOT_FOUND_BY_NAME"
    listing = (await async_client.get("/api/dashboard/foods", headers=b_headers))
    assert fid not in listing.text

    # the owner's own logging still works
    assert (await async_client.post(
        "/api/agent/log/food", json={"food_id": fid, "servings": 1, "meal_type": "lunch"}, headers=api_key_headers
    )).status_code == 201


async def test_owner_can_make_private_food_public(async_client, api_key_headers, b_headers):
    food = await _food(async_client, api_key_headers, "Share", 50, private=True)
    assert (await async_client.get(f"/api/foods/{food['id']}", headers=b_headers)).status_code == 404
    resp = await async_client.put(f"/api/foods/{food['id']}", json={"private": False}, headers=api_key_headers)
    assert resp.status_code == 200 and resp.json()["private"] is False
    assert (await async_client.get(f"/api/foods/{food['id']}", headers=b_headers)).status_code == 200
    # an explicit null leaves it alone
    resp = await async_client.put(f"/api/foods/{food['id']}", json={"private": None}, headers=api_key_headers)
    assert resp.status_code == 200 and resp.json()["private"] is False


async def test_private_food_cannot_hold_a_barcode(async_client, api_key_headers):
    # A private food with a barcode would hide that product from everyone else (barcodes are unique).
    resp = await async_client.post(
        "/api/foods", json={"name": "Squat", "barcode": "7610000000001", "private": True, "nutrients": {"kcal": 1}},
        headers=api_key_headers,
    )
    assert resp.status_code == 422
    food = await _food(async_client, api_key_headers, "Hidden", 50, private=True)
    resp = await async_client.put(f"/api/foods/{food['id']}", json={"barcode": "7610000000002"}, headers=api_key_headers)
    assert resp.status_code == 422 and resp.json()["detail"]["code"] == "PRIVATE_BARCODE"
    public = await _food(async_client, api_key_headers, "Labelled", 50, barcode="7610000000003")
    resp = await async_client.put(f"/api/foods/{public['id']}", json={"private": True}, headers=api_key_headers)
    assert resp.status_code == 422


async def test_food_detail_route_order(async_client, api_key_headers):
    food = await _food(async_client, api_key_headers, "Detail", 77, serving_size_g=50)
    detail = (await async_client.get(f"/api/foods/{food['id']}", headers=api_key_headers)).json()
    assert detail["nutrients"]["kcal"] == 77 and detail["servings"] == [] and detail["source"] == "manual"
    assert (await async_client.get("/api/foods/search?q=Detail", headers=api_key_headers)).status_code == 200
    assert (await async_client.get(f"/api/foods/{uuid.uuid4()}", headers=api_key_headers)).status_code == 404


# ---------------------------------------------------------------- dishes


async def test_dish_nutrient_math_and_logging(async_client, api_key_headers):
    rice = await _food(async_client, api_key_headers, "Rice", 130, protein=2.7)
    chicken = await _food(async_client, api_key_headers, "Chicken", 165, protein=31)
    resp = await async_client.post(
        "/api/agent/dishes",
        json={"name": "Plate", "components": [
            {"food_id": rice["id"], "quantity_g": 200}, {"food_id": chicken["id"], "quantity_g": 100}]},
        headers=api_key_headers,
    )
    assert resp.status_code == 201, resp.text
    dish = resp.json()
    # (130*2 + 165*1) / 300 g * 100 = 141.67 kcal per 100 g; one portion is the 300 g
    assert dish["nutrients"]["kcal"] == pytest.approx(425 / 3, rel=1e-6)
    assert dish["nutrients"]["protein"] == pytest.approx((2.7 * 2 + 31) / 3, rel=1e-6)
    assert dish["nutrients"]["fat"] is None
    assert dish["serving_size_g"] == 300
    assert [c["name"][:4] for c in dish["components"]] == ["Rice", "Chic"]
    assert dish["components"][0]["kcal"] == 260.0 and dish["components"][1]["kcal"] == 165.0
    assert set(dish) == {"id", "name", "serving_size_g", "nutrients", "components"}

    got = await async_client.get(f"/api/agent/dishes/{dish['id']}", headers=api_key_headers)
    assert got.json() == dish

    food = (await async_client.get(f"/api/foods/{dish['id']}", headers=api_key_headers)).json()
    assert food["source"] == "dish" and food["private"] is True and food["serving_label"] == "1 portion"

    found = (await async_client.get("/api/foods/search?q=Plate", headers=api_key_headers)).json()
    assert any(r["id"] == dish["id"] and r["source"] == "dish" for r in found)

    log = await async_client.post(
        "/api/agent/log/food", json={"food_id": dish["id"], "servings": 1, "meal_type": "dinner"}, headers=api_key_headers
    )
    assert log.status_code == 201
    assert log.json()["quantity_g"] == 300 and log.json()["kcal"] == pytest.approx(425, abs=0.1)


async def test_dish_portion_and_replace(async_client, api_key_headers):
    a = await _food(async_client, api_key_headers, "A", 100)
    b = await _food(async_client, api_key_headers, "B", 300)
    dish = (await async_client.post(
        "/api/agent/dishes",
        json={"name": "Mix", "portion_g": 150, "components": [
            {"food_id": a["id"], "quantity_g": 100}, {"food_id": b["id"], "quantity_g": 100}]},
        headers=api_key_headers,
    )).json()
    assert dish["serving_size_g"] == 150 and dish["nutrients"]["kcal"] == pytest.approx(200)

    upd = await async_client.put(
        f"/api/agent/dishes/{dish['id']}", json={"components": [{"food_id": b["id"], "quantity_g": 50}]},
        headers=api_key_headers,
    )
    assert upd.status_code == 200
    body = upd.json()
    assert body["name"] == "Mix" and body["nutrients"]["kcal"] == pytest.approx(300)
    assert body["serving_size_g"] == 50 and len(body["components"]) == 1


async def test_dish_validation_and_component_protection(async_client, api_key_headers):
    a = await _food(async_client, api_key_headers, "Part", 100)
    for comps in ([], [{"food_id": a["id"], "quantity_g": 0}], [{"food_id": a["id"], "quantity_g": 5}] * 31):
        resp = await async_client.post("/api/agent/dishes", json={"name": "d", "components": comps}, headers=api_key_headers)
        assert resp.status_code == 422
    missing = await async_client.post(
        "/api/agent/dishes", json={"name": "d", "components": [{"food_id": str(uuid.uuid4()), "quantity_g": 5}]},
        headers=api_key_headers,
    )
    assert missing.status_code == 404 and missing.json()["detail"]["code"] == "FOOD_NOT_FOUND"

    dish = (await async_client.post(
        "/api/agent/dishes", json={"name": "d", "components": [{"food_id": a["id"], "quantity_g": 5}]}, headers=api_key_headers
    )).json()
    assert (await async_client.delete(f"/api/foods/{a['id']}", headers=api_key_headers)).status_code == 409
    assert (await async_client.delete(f"/api/foods/{dish['id']}", headers=api_key_headers)).status_code == 204
    assert (await async_client.delete(f"/api/foods/{a['id']}", headers=api_key_headers)).status_code == 204


async def test_dish_isolation(async_client, api_key_headers, b_headers):
    secret = await _food(async_client, api_key_headers, "Mine", 100, private=True)
    comps = [{"food_id": secret["id"], "quantity_g": 100}]
    # B cannot build from A's private food
    resp = await async_client.post("/api/agent/dishes", json={"name": "steal", "components": comps}, headers=b_headers)
    assert resp.status_code == 404 and resp.json()["detail"]["code"] == "FOOD_NOT_FOUND"
    # a public dish cannot contain a private component
    resp = await async_client.post(
        "/api/agent/dishes", json={"name": "pub", "private": False, "components": comps}, headers=api_key_headers
    )
    assert resp.status_code == 422 and resp.json()["detail"]["code"] == "PRIVATE_COMPONENT"

    dish = (await async_client.post("/api/agent/dishes", json={"name": "own", "components": comps}, headers=api_key_headers)).json()
    flip = await async_client.put(f"/api/foods/{dish['id']}", json={"private": False}, headers=api_key_headers)
    assert flip.status_code == 422
    # B sees nothing of the dish
    assert (await async_client.get(f"/api/agent/dishes/{dish['id']}", headers=b_headers)).status_code == 404
    assert (await async_client.put(
        f"/api/agent/dishes/{dish['id']}", json={"components": comps}, headers=b_headers)).status_code == 404
    assert (await async_client.post(
        "/api/agent/log/food", json={"food_id": dish["id"], "servings": 1, "meal_type": "lunch"}, headers=b_headers
    )).status_code == 404
    assert not any(r["id"] == dish["id"] for r in (await async_client.get("/api/foods/search?q=own", headers=b_headers)).json())


# ---------------------------------------------------------------- progress math (pure)


def _days(start: date, weights: dict[int, float]) -> dict[date, float]:
    return {start + timedelta(days=i): w for i, w in weights.items()}


def test_daily_weights_average():
    d = date(2026, 1, 1)
    assert ps.daily_weights([(d, 80.0), (d, 82.0), (d + timedelta(days=1), 81.0)]) == {d: 81.0, d + timedelta(days=1): 81.0}


def test_smooth_trend_seed_gaps_and_alpha():
    start = date(2026, 1, 1)
    pts = ps.smooth_trend(_days(start, {0: 80.0, 3: 79.0}), end=start + timedelta(days=4))
    assert [p.trend_kg for p in pts[:3]] == [80.0, 80.0, 80.0]  # seeded, carried over the gap
    assert pts[3].trend_kg == pytest.approx(79.9)  # 80 + 0.1 * (79 - 80)
    assert pts[4].weight_kg is None and pts[4].trend_kg == pytest.approx(79.9)
    assert len(pts) == 5
    assert ps.smooth_trend({}, end=start) == []


def test_weekly_rate():
    start = date(2026, 1, 1)
    # a steady fall of 0.1 kg/day: the trend converges on the line, slope near 0.7 kg/week
    daily = {start + timedelta(days=i): 90 - 0.1 * i for i in range(40)}
    pts = ps.smooth_trend(daily, end=start + timedelta(days=39))
    kg, pct = ps.weekly_rate(pts)
    assert kg == pytest.approx(-0.7, abs=0.04)
    assert pct == pytest.approx(kg / pts[-1].trend_kg * 100)
    # one weigh-in in the span: no rate
    lone = ps.smooth_trend({start: 80.0, start + timedelta(days=30): 79.0}, end=start + timedelta(days=30))
    assert ps.weekly_rate(lone) == (None, None)
    assert ps.weekly_rate([]) == (None, None)


def test_tdee_gating_and_math():
    assert ps.estimate_tdee(2000, 13, 20, -1.0, 28) == (None, None)
    assert ps.estimate_tdee(2000, 20, 7, -1.0, 28) == (None, None)
    assert ps.estimate_tdee(None, 20, 20, -1.0, 28) == (None, None)
    tdee, conf = ps.estimate_tdee(2000, 14, 8, -1.0, 28)
    assert tdee == pytest.approx(2000 + 7700 / 28) and conf == "low"
    assert ps.estimate_tdee(2000, 21, 8, 0.0, 28) == (2000, "medium")
    assert ps.estimate_tdee(2000, 28, 8, 0.0, 28)[1] == "high"


def test_bmr_and_floor():
    assert ps.bmr_mifflin_st_jeor(80, 180, 36, "male") == 10 * 80 + 6.25 * 180 - 5 * 36 + 5
    assert ps.bmr_mifflin_st_jeor(60, 165, 30, "female") == 10 * 60 + 6.25 * 165 - 5 * 30 - 161
    assert ps.bmr_mifflin_st_jeor(60, 165, 30, "x") is None
    assert ps.safe_floor_kcal(None, None) == 1200
    assert ps.safe_floor_kcal(1400, "female") == 1400
    assert ps.safe_floor_kcal(1400, "male") == 1500
    assert ps.safe_floor_kcal(1800, "male") == 1800


# ---------------------------------------------------------------- progress endpoint


async def test_progress_empty_and_validation(async_client, api_key_headers):
    data = (await async_client.get("/api/agent/progress", headers=api_key_headers)).json()
    assert data["days"] == 28 and data["trend"] == [] and data["latest_trend_kg"] is None
    assert data["tdee_estimate_kcal"] is None and data["bmr_kcal"] is None and data["protein_per_kg"] is None
    assert data["safe_floor_kcal"] == 1200 and data["intake"]["days_logged"] == 0
    assert set(data) == {
        "days", "trend", "latest_trend_kg", "rate_kg_per_week", "rate_pct_per_week", "intake", "tdee_estimate_kcal",
        "tdee_confidence", "bmr_kcal", "maintenance_from_profile", "safe_floor_kcal", "targets", "protein_per_kg",
    }
    assert set(data["targets"]) == {"target_kcal", "target_protein_g", "target_weight_kg"}
    for days in (6, 121):
        assert (await async_client.get(f"/api/agent/progress?days={days}", headers=api_key_headers)).status_code == 422


async def test_progress_full(async_client, api_key_headers, test_user):
    today = today_for(test_user)
    await async_client.put("/api/agent/profile", json={
        "height_cm": 180, "birth_year": today.year - 36, "sex": "male", "activity_level": "moderate"}, headers=api_key_headers)
    food = await _food(async_client, api_key_headers, "Meal", 200, protein=10)
    for i in range(28):
        day = today - timedelta(days=i)
        assert (await async_client.post(
            "/api/agent/log/food", json={"food_id": food["id"], "quantity_g": 1000, "meal_type": "dinner", "date": str(day)},
            headers=api_key_headers)).status_code == 201
        if i % 3 == 0:
            assert (await async_client.post(
                "/api/agent/log/weight", json={"weight_kg": 90 - 0.05 * (27 - i), "date": str(day)}, headers=api_key_headers
            )).status_code == 201
    data = (await async_client.get("/api/agent/progress?days=28", headers=api_key_headers)).json()
    # Today is still open, so the 27 finished days count.
    assert data["intake"] == {"days_logged": 27, "avg_kcal": 2000.0, "avg_protein_g": 100.0}
    assert data["trend"][-1]["date"] == str(today) and data["latest_trend_kg"] is not None
    assert data["rate_kg_per_week"] is not None and data["rate_kg_per_week"] < 0
    assert data["tdee_estimate_kcal"] is not None and data["tdee_confidence"] == "high"
    bmr = 10 * data["latest_trend_kg"] + 6.25 * 180 - 5 * 36 + 5
    assert data["bmr_kcal"] == pytest.approx(bmr, abs=1)
    assert data["maintenance_from_profile"] == pytest.approx(bmr * 1.55, abs=1)
    assert data["safe_floor_kcal"] == max(round(bmr), 1500)
    assert data["protein_per_kg"] == pytest.approx(150 / data["latest_trend_kg"], abs=0.01)
    assert data["targets"]["target_kcal"] == 2000


# ---------------------------------------------------------------- summary params


async def test_summary_day_and_week_end_date(async_client, api_key_headers, test_user):
    day = today_for(test_user) - timedelta(days=3)
    food = await _food(async_client, api_key_headers, "Past", 100)
    await async_client.post(
        "/api/agent/log/food", json={"food_id": food["id"], "quantity_g": 200, "meal_type": "lunch", "date": str(day)},
        headers=api_key_headers)
    assert (await async_client.get("/api/agent/summary/today", headers=api_key_headers)).json()["totals"]["kcal"] == 0
    past = (await async_client.get(f"/api/agent/summary/today?day={day}", headers=api_key_headers)).json()
    assert past["totals"]["kcal"] == 200
    week = await async_client.get(f"/api/agent/summary/week?end_date={day}", headers=api_key_headers)
    assert week.status_code == 200 and week.json()["daily_avg"]["kcal"] > 0
