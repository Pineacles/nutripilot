"""Game features: streak with freezes, day goals, trend weight, prints, quests, year grid, settings."""

from __future__ import annotations

import time
import uuid
from datetime import UTC, timedelta
from types import SimpleNamespace

import pytest

from app.models.food import Food
from app.models.food_log import FoodLog
from app.models.nutrient import Nutrient
from app.models.weekly_quest import WeeklyQuest
from app.services import game_service as gs
from app.services.clock import today_for
from app.services.summary_service import get_stats_summary

pytestmark = pytest.mark.asyncio

T = today_for(SimpleNamespace(timezone="Europe/Zurich"))


def ago(n):
    return T - timedelta(days=n)


async def _food(db, protein=0.0, barcode=None, created_by=None, fiber=0.0):
    food = Food(id=uuid.uuid4(), name=f"G {uuid.uuid4().hex[:8]}", source="manual", barcode=barcode, created_by=created_by)
    db.add(food)
    await db.flush()
    db.add(Nutrient(food_id=food.id, kcal=100, protein=protein, fiber=fiber))
    await db.commit()
    return food


async def _log(db, user, food, day, meal="lunch", qty=100):
    db.add(FoodLog(user_id=user.id, food_id=food.id, date=day, quantity_g=qty, meal_type=meal))
    await db.commit()


async def _log_days(db, user, offsets):
    food = await _food(db)
    for n in offsets:
        await _log(db, user, food, ago(n))
    return food


# --- streak -----------------------------------------------------------------

async def test_streak_earns_freeze_up_to_max():
    st = gs.compute_streak({ago(n) for n in range(1, 8)}, T)
    assert st.current == 7 and st.longest == 7
    assert st.banked == 3  # started with 2, the 7 day run earned one


async def test_streak_consumes_freeze_and_freeze_day_adds_nothing():
    st = gs.compute_streak({ago(5), ago(4), ago(2), ago(1)}, T)
    assert st.current == 4  # the freeze day does not count
    assert st.banked == 1
    assert st.states[ago(3)] == "freeze"


async def test_streak_breaks_without_freezes_and_keeps_longest():
    logged = {ago(12), ago(11), ago(10), ago(1)}  # gap of 8 days is longer than the 2 freezes
    st = gs.compute_streak(logged, T)
    assert st.current == 1 and st.longest == 3
    assert st.banked == 2  # a long gap leaves the banked freezes untouched
    assert st.states[ago(9)] == "empty" and st.states[ago(7)] == "empty" and st.freeze_days == []


async def test_today_pending_does_not_break_and_logging_adds_one():
    base = {ago(3), ago(2), ago(1)}
    assert gs.compute_streak(base, T).current == 3
    assert gs.compute_streak(base | {T}, T).current == 4
    strip = gs.strip_of(gs.compute_streak(base, T), T)
    assert len(strip) == 14 and strip[-1]["state"] == "pending"
    assert gs.strip_of(gs.compute_streak(base | {T}, T), T)[-1]["state"] == "logged"


async def test_backfilling_a_missed_day_repairs_the_streak():
    base = {ago(12), ago(11), ago(10)} | {ago(n) for n in range(1, 7)}
    assert gs.compute_streak(base, T).current == 6
    repaired = gs.compute_streak(base | {ago(7)}, T)
    assert repaired.current == 10


async def test_new_run_after_long_gap_gets_a_freeze():
    # Freezes exhausted earlier, then a long break, then 22, 23, (24 missed), 25, 26.
    oct22 = ago(4)
    logged = {ago(40), ago(38), ago(36), ago(34)}  # three single gaps use 2 freezes then break
    logged |= {oct22, oct22 + timedelta(days=1), oct22 + timedelta(days=3), oct22 + timedelta(days=4)}  # the last one is today
    st = gs.compute_streak(logged, T)
    assert st.current == 4
    assert st.freeze_days[-1] == oct22 + timedelta(days=2)
    assert st.states[oct22 + timedelta(days=2)] == "freeze"


async def test_trailing_gap_longer_than_freezes_ends_run():
    st = gs.compute_streak({ago(8), ago(7)}, T)  # 6 missed days, 2 freezes: broken, freezes kept
    assert st.current == 0 and st.banked == 2 and st.freeze_days == []
    short = gs.compute_streak({ago(3), ago(2)}, T)  # 1 missed day (yesterday) is covered
    assert short.current == 2 and short.states[ago(1)] == "freeze" and short.banked == 1


async def test_returns_after_three_days_away():
    st = gs.compute_streak({ago(20), ago(16), ago(15), ago(11), ago(10), ago(1)}, T)
    assert st.returns[-1] == ago(1) and ago(16) in st.returns
    gap3 = gs.compute_streak({ago(10), ago(6)}, T)  # 3 days between
    assert gap3.returns == [ago(6)]
    gap2 = gs.compute_streak({ago(10), ago(7)}, T)  # 2 days between
    assert gap2.returns == []


async def test_strip_states():
    st = gs.compute_streak({ago(5), ago(4), ago(2)}, T)
    states = {s["date"]: s["state"] for s in gs.strip_of(st, T)}
    assert states[ago(5)] == "logged" and states[ago(3)] == "freeze"
    assert states[ago(13)] == "empty" and states[T] == "pending"


async def test_milestones():
    assert [gs.next_milestone(n) for n in (0, 6, 7, 29, 100, 364, 365, 399, 400)] == [7, 7, 30, 30, 200, 365, 400, 400, 500]


# --- weight -----------------------------------------------------------------

def _weight_facts(weights):
    return gs.Facts(today=T, weights=weights)


async def test_ewma_trend_carries_through_gaps():
    trend = gs.compute_trend({ago(3): 80.0, ago(2): 79.0}, T)
    assert trend[ago(3)] == 80.0
    assert trend[ago(2)] == pytest.approx(79.9)
    assert trend[T] == pytest.approx(79.9)


async def test_eta_only_when_trend_moves_toward_goal():
    weights = {ago(n): 90 - 0.1 * (60 - n) for n in range(60, -1, -1)}
    f = _weight_facts(weights)
    trend = gs.compute_trend(weights, T)
    down = gs.compute_weight(f, SimpleNamespace(target_weight_kg=80.0), trend)
    assert down["direction"] == "down" and down["eta_date"] is not None and down["eta_date"] > T
    away = gs.compute_weight(f, SimpleNamespace(target_weight_kg=100.0), trend)
    assert away["direction"] == "up" and away["eta_date"] is None
    reached = gs.compute_weight(f, SimpleNamespace(target_weight_kg=round(down["trend_kg"], 1)), trend)
    assert reached["direction"] == "reached" and reached["eta_date"] is None
    assert gs.compute_weight(f, SimpleNamespace(target_weight_kg=None), trend)["direction"] is None
    assert down["trend_change_7d"] < 0 and down["trend_change_28d"] < down["trend_change_7d"]
    assert gs.compute_weight(_weight_facts({}), SimpleNamespace(target_weight_kg=80.0), {}) is None


async def test_weigh_in_weeks_need_three_days():
    mon = gs.monday_of(T) - timedelta(weeks=1)
    weights = {mon + timedelta(days=i): 80.0 for i in (0, 2, 4)}  # last week qualifies
    weights[gs.monday_of(T)] = 80.0  # this week: only one so far
    f = _weight_facts(weights)
    w = gs.compute_weight(f, SimpleNamespace(target_weight_kg=None), gs.compute_trend(weights, T))
    assert w["weigh_in_weeks_current"] == 1 and w["weigh_in_weeks_longest"] == 1
    assert w["this_week_weigh_ins"] == 1


# --- API: day goals, settings ----------------------------------------------

async def test_default_day_goals_and_unavailable_goals(async_client, auth_headers, test_user, db_session):
    data = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()
    assert [g["key"] for g in data["day_goals"]] == ["meals", "protein"]
    assert data["day_closed"] is False and data["enabled"] is True and data["celebrations"] == "full"
    keys = {a["key"] for a in data["available_goals"]}
    assert keys == {"meals", "protein", "water", "fiber"}  # no supplements defined
    test_user.target_fiber_g = 0
    await db_session.commit()
    data = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()
    assert "fiber" not in {a["key"] for a in data["available_goals"]}


async def test_day_closed_when_all_goals_done(async_client, auth_headers, test_user, db_session):
    test_user.day_goals = [{"key": "meals", "target": 2}, {"key": "protein", "target": None}]
    await db_session.commit()
    rich = await _food(db_session, protein=200)
    await _log(db_session, test_user, rich, T, meal="breakfast")
    data = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()
    assert data["day_closed"] is False
    await _log(db_session, test_user, rich, T, meal="lunch")
    data = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()
    assert data["day_closed"] is True and all(g["done"] for g in data["day_goals"])
    assert data["streak"]["today_logged"] is True and data["streak"]["current"] == 1


async def test_settings_put_validation(async_client, auth_headers):
    put = lambda body: async_client.put("/api/v1/settings/game", json=body, headers=auth_headers)  # noqa: E731
    assert (await put({"celebrations": "loud"})).status_code == 422
    assert (await put({"day_goals": [{"key": "kcal"}]})).status_code == 422
    four = [{"key": k} for k in ("meals", "protein", "water", "fiber")]
    assert (await put({"day_goals": four})).status_code == 422
    assert (await put({"day_goals": [{"key": "meals"}, {"key": "meals"}]})).status_code == 422
    resp = await put({"celebrations": "quiet", "show_streak": False, "day_goals": [{"key": "meals", "target": 4}, {"key": "water"}]})
    assert resp.status_code == 200
    body = resp.json()
    assert body["game_settings"] == {"enabled": True, "show_streak": False, "celebrations": "quiet"}
    assert body["day_goals"] == [{"key": "meals", "target": 4.0}, {"key": "water", "target": None}]
    settings = (await async_client.get("/api/v1/settings", headers=auth_headers)).json()
    assert settings["game_settings"]["celebrations"] == "quiet"
    assert [g["key"] for g in settings["day_goals"]] == ["meals", "water"]


# --- prints -----------------------------------------------------------------

async def test_prints_idempotent_with_historic_dates_and_backfill_flag(async_client, auth_headers, test_user, db_session):
    await _log_days(db_session, test_user, range(4, 11))  # 7 days in a row, the 7th is 4 days ago
    first = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()
    streak = next(p for p in first["prints"] if p["key"] == "streak")
    assert streak["runs"][0]["earned_at"] == str(ago(4))
    assert streak["runs"][1]["earned_at"] is None
    unseen = [u for u in first["unseen"] if u["kind"] == "print" and u["key"] == "streak"]
    assert len(unseen) == 1 and unseen[0]["backfill"] is True and unseen[0]["run"] == 1 and unseen[0]["id"] is None
    again = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()
    assert len([u for u in again["unseen"] if u["kind"] == "print"]) == len([u for u in first["unseen"] if u["kind"] == "print"])
    # A print earned after the backfill is not flagged.
    for _ in range(5):
        await _food(db_session, created_by=test_user.id)
    later = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()
    own = [u for u in later["unseen"] if u["key"] == "own_foods"]
    assert len(own) == 1 and own[0]["backfill"] is False and own[0]["date"] == str(T)


async def test_hidden_print_is_masked_until_earned(async_client, auth_headers, test_user, db_session):
    data = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()
    comeback = next(p for p in data["prints"] if p["key"] == "comeback")
    assert comeback["title"] == "Hidden print" and comeback["progress"] is None and comeback["hidden"] is True
    # logged 12 days ago, 5 days away (2 covered by freezes, 3 empty), back 6 days ago
    await _log_days(db_session, test_user, [12, 6])
    data = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()
    comeback = next(p for p in data["prints"] if p["key"] == "comeback")
    assert comeback["title"] == "Comeback" and comeback["runs"][0]["earned_at"] == str(ago(6))


async def test_seen_marks_prints_quests_and_freezes(async_client, auth_headers, test_user, db_session):
    await _log_days(db_session, test_user, [3, 1])  # day 2 ago covered by a freeze
    data = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()
    assert any(u["kind"] == "freeze" and u["date"] == str(ago(2)) for u in data["unseen"])
    resp = await async_client.post("/api/dashboard/game/seen", json={"freezes_through": str(ago(2))}, headers=auth_headers)
    assert resp.status_code == 204
    data = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()
    assert not any(u["kind"] == "freeze" for u in data["unseen"])
    await _log_days(db_session, test_user, range(4, 11))
    data = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()
    assert any(u["kind"] == "print" for u in data["unseen"])
    resp = await async_client.post("/api/dashboard/game/seen", json={"all": True}, headers=auth_headers)
    assert resp.status_code == 204
    data = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()
    assert data["unseen"] == []


# --- quests -----------------------------------------------------------------

async def test_quests_are_deterministic_and_swap_once(async_client, auth_headers):
    first = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()["quests"]
    second = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()["quests"]
    assert len(first["items"]) == 3 and first["swap_available"] is True
    assert [q["key"] for q in first["items"]] == [q["key"] for q in second["items"]]
    assert len({q["area"] for q in first["items"]}) == 3  # different areas preferred
    quest = first["items"][0]
    swap = await async_client.post(f"/api/dashboard/game/quests/{quest['id']}/swap", headers=auth_headers)
    assert swap.status_code == 200 and swap.json()["key"] != quest["key"]
    again = await async_client.post(f"/api/dashboard/game/quests/{first['items'][1]['id']}/swap", headers=auth_headers)
    assert again.status_code == 409 and again.json()["detail"]["code"] == "SWAP_USED"
    after = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()["quests"]
    assert after["swap_available"] is False and len(after["items"]) == 3


async def test_swap_unknown_quest_is_404(async_client, auth_headers):
    resp = await async_client.post(f"/api/dashboard/game/quests/{uuid.uuid4()}/swap", headers=auth_headers)
    assert resp.status_code == 404


async def test_quest_pool_respects_eligibility(test_user, db_session):
    test_user.target_protein_g = 0
    await db_session.commit()
    f = await gs.load_facts(db_session, test_user)
    pool = gs.eligible_quests(test_user, f, gs.derive(f, test_user), gs.monday_of(T))
    assert "protein_days" not in pool and "weigh_ins" not in pool and "supplements_days" not in pool
    assert pool["new_foods"] == 3 and pool["distinct_foods"] == 15
    assert not any(k in pool for k in ("kcal_days", "fat_days", "weight_change"))


async def test_quest_done_at_is_set_once(async_client, auth_headers, test_user, db_session):
    ws = gs.monday_of(T)
    quest = WeeklyQuest(id=uuid.uuid4(), user_id=test_user.id, week_start=ws, key="log_days", target=1)
    db_session.add(quest)
    await db_session.commit()
    data = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()
    assert data["quests"]["items"][0]["done"] is False
    await _log_days(db_session, test_user, [0])
    data = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()
    assert data["quests"]["items"][0]["done"] is True
    assert any(u["kind"] == "quest" and u["id"] == str(quest.id) for u in data["unseen"])
    await db_session.refresh(quest)
    assert quest.done_at == T


async def test_disabled_game_generates_no_quests(async_client, auth_headers):
    await async_client.put("/api/v1/settings/game", json={"enabled": False}, headers=auth_headers)
    data = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()
    assert data["enabled"] is False and data["quests"]["items"] == []


# --- year grid, records, recap, agent -----------------------------------------

async def test_year_levels(async_client, auth_headers, test_user, db_session):
    test_user.day_goals = [{"key": "meals", "target": 2}, {"key": "protein", "target": None}]
    await db_session.commit()
    poor, rich = await _food(db_session, protein=0), await _food(db_session, protein=200)
    await _log(db_session, test_user, poor, ago(4))                      # logged only
    await _log(db_session, test_user, poor, ago(3), meal="breakfast")    # meals goal done, protein not
    await _log(db_session, test_user, poor, ago(3), meal="dinner")
    await _log(db_session, test_user, rich, ago(2), meal="breakfast")    # closed
    await _log(db_session, test_user, rich, ago(2), meal="dinner")
    year = {y["date"]: y["level"] for y in (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()["year"]}
    assert len(year) == 365
    assert (year[str(ago(5))], year[str(ago(4))], year[str(ago(3))], year[str(ago(2))]) == (0, 1, 2, 3)


async def test_most_varied_day_record(db_session, test_user):
    foods = [await _food(db_session) for _ in range(3)]
    for fd in foods:
        await _log(db_session, test_user, fd, ago(2))
    await _log(db_session, test_user, foods[0], ago(1))
    await _log(db_session, test_user, foods[0], ago(1))  # same food twice is one food
    stats = await get_stats_summary(db_session, test_user, 30)
    assert stats.most_varied_day == {"date": str(ago(2)), "value": 3}


async def test_recap_and_available_flag(async_client, auth_headers, test_user, db_session):
    last_week = gs.monday_of(T) - timedelta(weeks=1)
    rich = await _food(db_session, protein=120)
    for i in range(3):
        await _log(db_session, test_user, rich, last_week + timedelta(days=i))
    data = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()
    assert data["recap_available"] == str(last_week)
    recap = (await async_client.get("/api/dashboard/game/recap", headers=auth_headers)).json()
    assert recap["week_start"] == str(last_week) and recap["logged_days"] == 3
    assert recap["best_protein_day"]["value"] == 120.0 and recap["distinct_foods"] == 1
    resp = await async_client.post("/api/dashboard/game/recap/seen", json={"week": str(last_week)}, headers=auth_headers)
    assert resp.status_code == 204
    assert (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()["recap_available"] is None


async def test_agent_summary_marks_nothing_seen(async_client, api_key_headers, auth_headers, test_user, db_session):
    await _log_days(db_session, test_user, range(4, 11))
    resp = await async_client.get("/api/agent/game/summary", headers=api_key_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["streak_longest"] == 7 and body["next_milestone"] in (7, 30)
    assert body["recent_prints"][0]["key"] == "streak" and len(body["quests"]) == 3
    data = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()
    assert any(u["kind"] == "print" for u in data["unseen"])


async def test_game_state_is_fast_with_hundreds_of_days(async_client, auth_headers, test_user, db_session):
    foods = [await _food(db_session, protein=30) for _ in range(5)]
    for n in range(400):
        for fd in foods:
            db_session.add(FoodLog(user_id=test_user.id, food_id=fd.id, date=ago(n), quantity_g=100, meal_type="lunch"))
    await db_session.commit()
    start = time.perf_counter()
    resp = await async_client.get("/api/dashboard/game", headers=auth_headers)
    elapsed = time.perf_counter() - start
    assert resp.status_code == 200 and resp.json()["streak"]["current"] == 400
    assert elapsed < 1.5, f"game state took {elapsed:.2f}s"


async def test_finished_quest_cannot_be_swapped(async_client, auth_headers, db_session):
    from datetime import date

    from app.models.weekly_quest import WeeklyQuest

    items = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()["quests"]["items"]
    row = await db_session.get(WeeklyQuest, uuid.UUID(items[0]["id"]))
    row.done_at = date.today()
    await db_session.commit()
    resp = await async_client.post(f"/api/dashboard/game/quests/{items[0]['id']}/swap", headers=auth_headers)
    assert resp.status_code == 409 and resp.json()["detail"]["code"] == "QUEST_DONE"


# --- review fixes ---------------------------------------------------------------

async def test_trend_kg_capped_at_distance_to_goal():
    trend = {ago(n): 80.0 - 0.5 * (10 - n) for n in range(10, -1, -1)}  # 80 -> 75
    kg, _reached, _side = gs._trend_metrics(gs.Facts(today=T), 78.0, trend)
    assert kg.value == pytest.approx(2.0)  # passing the goal earns nothing more


async def test_quest_titles_and_log_days_target():
    assert gs.QUESTS["log_days"][1](1) == "Log food on 1 day"
    assert gs.QUESTS["distinct_foods"][1](15) == "Log 15 different foods"
    assert gs.QUESTS["new_foods"][1](1) == "Try 1 new food"
    assert "1 days" not in " ".join(t(1) for _a, t in gs.QUESTS.values())


async def test_new_prints_and_thresholds():
    assert gs.PRINT_BY_KEY["logged_days"].runs == (50, 100, 250, 365)
    assert gs.PRINT_BY_KEY["steady_weeks"].runs == (4, 12, 26)
    assert gs.PRINT_BY_KEY["week_variety"].runs == (15, 25, 35)
    assert gs.PRINT_BY_KEY["comeback"].runs == (1, 3, 10)
    assert gs.PRINT_BY_KEY["water_run"].name == "Water streak"
    assert gs.PRINT_BY_KEY["logged_days"].run_title(50) == "50 logged days"


async def test_hidden_water_and_protein(async_client, auth_headers, test_user, db_session):
    test_user.hidden_nutrients = ["water", "protein"]
    await db_session.commit()
    await _log_days(db_session, test_user, [1])
    data = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()
    assert [g["key"] for g in data["day_goals"]] == ["meals"]
    assert not {"water", "protein"} & {a["key"] for a in data["available_goals"]}
    assert not {"water_run", "protein_weeks"} & {p["key"] for p in data["prints"]}
    recap = (await async_client.get("/api/dashboard/game/recap", headers=auth_headers)).json()
    assert recap["water_target_days"] is None


async def test_recap_new_fields(async_client, auth_headers, test_user, db_session):
    last_week = gs.monday_of(T) - timedelta(weeks=1)
    await _log(db_session, test_user, await _food(db_session), last_week)
    recap = (await async_client.get("/api/dashboard/game/recap", headers=auth_headers)).json()
    assert recap["trend_toward_goal"] is None
    assert len(recap["days"]) == 7 and recap["days"][0] == {"date": str(last_week), "logged": True, "closed": False}
    assert recap["days"][1]["logged"] is False


async def test_comeback_unseen_and_acknowledge(async_client, auth_headers, test_user, db_session):
    await _log_days(db_session, test_user, [12, 0])
    data = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()
    back = [u for u in data["unseen"] if u["kind"] == "comeback"]
    assert len(back) == 1 and back[0]["title"] == "Welcome back" and back[0]["date"] == str(T)
    assert back[0]["description"] == "Today starts a new streak."
    resp = await async_client.post("/api/dashboard/game/seen", json={"comeback_through": str(T)}, headers=auth_headers)
    assert resp.status_code == 204
    data = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()
    assert not any(u["kind"] == "comeback" for u in data["unseen"])


async def test_freeze_notice_waits_two_days(async_client, auth_headers, test_user, db_session):
    await _log_days(db_session, test_user, [2, 0])  # yesterday is a freeze day, still backfillable
    data = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()
    assert not any(u["kind"] == "freeze" for u in data["unseen"])


async def test_own_food_date_uses_user_timezone(test_user, db_session):
    from datetime import datetime

    from app.models.food import Food

    test_user.timezone = "Pacific/Auckland"
    food = Food(id=uuid.uuid4(), name="tz food", source="manual", created_by=test_user.id)
    db_session.add(food)
    await db_session.flush()
    food.created_at = datetime(2026, 1, 1, 20, 0, tzinfo=UTC)  # already Jan 2 in Auckland
    await db_session.commit()
    f = await gs.load_facts(db_session, test_user)
    assert f.own_food_dates == [datetime(2026, 1, 2).date()]


def test_streak_restart_and_days_that_do_not_count():
    today = ago(0)
    logged = {ago(n) for n in range(0, 20)}
    assert gs.compute_streak(logged, today).current == 20
    # Restarting today: only today counts, history keeps the longest run.
    st = gs.compute_streak(logged, today, restart_from=today)
    assert st.current == 1 and st.longest == 19 and st.banked == gs.FREEZES_START
    # Restarting before anything is logged today: zero until today is logged.
    st = gs.compute_streak(logged - {today}, today, restart_from=today)
    assert st.current == 0
    # Restart five days ago: those five days form the new run.
    assert gs.compute_streak(logged, today, restart_from=ago(4)).current == 5
    # A day that doesn't count is a missed day: a freeze covers one, so the streak goes on one shorter.
    st = gs.compute_streak(logged, today, excluded={ago(3)})
    assert st.current == 19 and ago(3) in st.freeze_days
    # Twenty logged days bank the full three freezes; four days in a row don't fit and end the run.
    assert gs.compute_streak(logged, today, excluded={ago(3), ago(4), ago(5), ago(6)}).current == 3


async def test_restart_and_day_counts_endpoints(async_client, auth_headers, test_user):
    today = today_for(test_user)
    resp = await async_client.put("/api/dashboard/game/streak", json={"restart_from": str(today)}, headers=auth_headers)
    assert resp.status_code == 200 and resp.json()["previous"] is None
    state = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()
    assert state["streak"]["restart_from"] == str(today)
    undo = await async_client.put("/api/dashboard/game/streak", json={"restart_from": None}, headers=auth_headers)
    assert undo.json()["previous"] == str(today)
    future = await async_client.put("/api/dashboard/game/streak", json={"restart_from": str(today + timedelta(days=2))}, headers=auth_headers)
    assert future.status_code == 422
    day = today - timedelta(days=1)
    assert (await async_client.put(f"/api/dashboard/game/days/{day}", json={"counts": False}, headers=auth_headers)).status_code == 204
    state = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()
    assert state["streak"]["excluded_days"] == [str(day)]
    await async_client.put(f"/api/dashboard/game/days/{day}", json={"counts": True}, headers=auth_headers)
    state = (await async_client.get("/api/dashboard/game", headers=auth_headers)).json()
    assert state["streak"]["excluded_days"] == []
