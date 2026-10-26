"""Game features: streak with freezes, day goals, trend weight, prints, weekly quests, recap.

Everything here is recomputed from the logs on every request, so a backfilled or edited log repairs
the numbers by itself. Only three things are stored: earned prints (so they keep the day they were
reached and can be marked seen), the weekly quests, and the user's settings.

Nothing rewards low intake: there are no kcal, fat or single-day weight goals, prints or quests.
"""

from __future__ import annotations

import math
import random
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.achievement import Achievement
from app.models.food import Food
from app.models.food_log import FoodLog
from app.models.food_serving import FoodServing
from app.models.micronutrient_target import MicronutrientTarget
from app.models.nutrient import Nutrient
from app.models.supplement import Supplement
from app.models.supplement_definition import SupplementDefinition
from app.models.user import User
from app.models.water_log import WaterLog
from app.models.weekly_quest import WeeklyQuest
from app.models.weight_log import WeightLog
from app.schemas.game import DAY_GOAL_KEYS
from app.services.clock import date_for, today_for
from app.services.summary_service import SUPP_MICRO_KEY_MAP

FREEZES_START = 2
FREEZES_MAX = 3
STREAK_MILESTONES = (7, 30, 100, 200, 365)
GAME_DEFAULTS = {"enabled": True, "show_streak": True, "celebrations": "full"}
MICRO_FIELDS = ("calcium", "potassium", "omega3", "zinc", "vit_d", "vit_k2", "vit_c", "magnesium", "b12", "iron")
GOAL_BAND_KG = 0.3
ETA_MAX_DAYS = 730
DEFAULT_MEALS_TARGET = 3
MAX_DAY_GOALS = 3

GOAL_INFO = {
    "meals": ("Meals logged", "meals"),
    "protein": ("Protein", "g"),
    "water": ("Water", "ml"),
    "fiber": ("Fiber", "g"),
    "supplements": ("Supplements taken", "taken"),
}


def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _days(start: date, end: date):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


def _pl(n: float, word: str) -> str:
    n = int(n)
    return f"{n} {word}" if n == 1 else f"{n} {word}s"


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

def game_settings_of(user: User) -> dict:
    stored = user.game_settings or {}
    out = dict(GAME_DEFAULTS)
    for k in GAME_DEFAULTS:
        if k in stored and stored[k] is not None:
            out[k] = stored[k]
    if out["celebrations"] not in ("full", "quiet", "off"):
        out["celebrations"] = GAME_DEFAULTS["celebrations"]
    return out


def hidden_of(user: User) -> set[str]:
    return set(getattr(user, "hidden_nutrients", None) or [])


def default_day_goals(user: User) -> list[dict]:
    goals = [{"key": "meals", "target": DEFAULT_MEALS_TARGET}]
    if (user.target_protein_g or 0) > 0 and "protein" not in hidden_of(user):
        goals.append({"key": "protein", "target": None})
    return goals


def day_goals_of(user: User) -> list[dict]:
    """The goal choice as stored, or the defaults when the user never chose."""
    if user.day_goals:
        return [{"key": g["key"], "target": g.get("target")} for g in user.day_goals if g.get("key") in DAY_GOAL_KEYS]
    return default_day_goals(user)


async def update_game_settings(db: AsyncSession, user: User, body) -> dict:
    if body.enabled is not None or body.show_streak is not None or body.celebrations is not None:
        merged = game_settings_of(user)
        for k in ("enabled", "show_streak", "celebrations"):
            v = getattr(body, k)
            if v is not None:
                merged[k] = v
        user.game_settings = merged
    if body.day_goals is not None:
        if not body.day_goals:
            user.day_goals = None
        else:
            user.day_goals = [
                {"key": g.key, "target": g.target if g.key == "meals" else None} for g in body.day_goals
            ]
    await db.commit()
    return {"game_settings": game_settings_of(user), "day_goals": day_goals_of(user)}


# ---------------------------------------------------------------------------
# Facts: a handful of aggregate queries, then everything is dictionaries
# ---------------------------------------------------------------------------

@dataclass
class Facts:
    today: date
    hidden: set = field(default_factory=set)
    day_foods: dict[date, set] = field(default_factory=lambda: defaultdict(set))
    day_meals: dict[date, set] = field(default_factory=lambda: defaultdict(set))
    day_logs: Counter = field(default_factory=Counter)
    day_protein: dict[date, float] = field(default_factory=lambda: defaultdict(float))
    day_fiber: dict[date, float] = field(default_factory=lambda: defaultdict(float))
    day_micros: dict[date, dict] = field(default_factory=lambda: defaultdict(lambda: defaultdict(float)))
    first_logged: dict = field(default_factory=dict)  # food_id -> first date
    barcode_foods: set = field(default_factory=set)
    day_water: dict[date, float] = field(default_factory=dict)
    day_supps: dict[date, set] = field(default_factory=lambda: defaultdict(set))
    weights: dict[date, float] = field(default_factory=dict)
    active_supps: set = field(default_factory=set)
    micro_targets: dict[str, float] = field(default_factory=dict)
    own_food_dates: list[date] = field(default_factory=list)
    serving_dates: list[date] = field(default_factory=list)

    @property
    def logged(self) -> set[date]:
        return {d for d in self.day_logs if d <= self.today}


async def load_facts(db: AsyncSession, user: User) -> Facts:
    f = Facts(today=today_for(user), hidden=hidden_of(user))
    uid = user.id

    cols = [getattr(Nutrient, m) for m in MICRO_FIELDS]
    rows = await db.execute(
        select(
            FoodLog.date, FoodLog.food_id, FoodLog.meal_type, FoodLog.quantity_g, Food.barcode,
            Nutrient.protein, Nutrient.fiber, *cols,
        )
        .join(Food, Food.id == FoodLog.food_id)
        .outerjoin(Nutrient, Nutrient.food_id == Food.id)
        .where(FoodLog.user_id == uid)
    )
    for r in rows.all():
        d, food_id, meal, qty, barcode, protein, fiber, *micros = r
        ratio = (qty or 0) / 100.0
        f.day_logs[d] += 1
        f.day_foods[d].add(food_id)
        f.day_meals[d].add(meal)
        f.day_protein[d] += (protein or 0) * ratio
        f.day_fiber[d] += (fiber or 0) * ratio
        dm = f.day_micros[d]
        for name, val in zip(MICRO_FIELDS, micros, strict=True):
            if val is not None:
                dm[name] += val * ratio
        if food_id not in f.first_logged or d < f.first_logged[food_id]:
            f.first_logged[food_id] = d
        if barcode:
            f.barcode_foods.add(food_id)

    # Same name twice: the newest definition wins (as summary_service does).
    defs = await db.execute(
        select(SupplementDefinition).where(SupplementDefinition.user_id == uid)
        .order_by(SupplementDefinition.created_at, SupplementDefinition.id)
    )
    defs_by_name = {d.name.lower(): d for d in defs.scalars().all()}
    f.active_supps = {n for n, d in defs_by_name.items() if d.active is not False}

    supp_rows = await db.execute(select(Supplement.date, Supplement.name).where(Supplement.user_id == uid))
    for d, name in supp_rows.all():
        f.day_supps[d].add(name.lower())
        defn = defs_by_name.get(name.lower())
        if defn and defn.micronutrients:
            for supp_key, value in defn.micronutrients.items():
                mapped = SUPP_MICRO_KEY_MAP.get(supp_key, supp_key)
                if mapped in MICRO_FIELDS and isinstance(value, (int, float)):
                    f.day_micros[d][mapped] += value

    water = await db.execute(
        select(WaterLog.date, func.sum(WaterLog.amount_ml)).where(WaterLog.user_id == uid).group_by(WaterLog.date)
    )
    f.day_water = {d: float(v or 0) for d, v in water.all()}

    weights = await db.execute(
        select(WeightLog.date, func.avg(WeightLog.weight_kg)).where(WeightLog.user_id == uid).group_by(WeightLog.date)
    )
    f.weights = {d: float(v) for d, v in weights.all()}

    targets = await db.execute(select(MicronutrientTarget).where(MicronutrientTarget.user_id == uid))
    for t in targets.scalars().all():
        mapped = SUPP_MICRO_KEY_MAP.get(t.nutrient, t.nutrient)
        # Only nutrients the daily totals track (creatine, fiber etc. are not micro days).
        if mapped in MICRO_FIELDS and t.nutrient not in f.hidden and mapped not in f.hidden and t.target_value and t.target_value > 0:
            f.micro_targets[mapped] = t.target_value

    own = await db.execute(select(Food.created_at).where(Food.created_by == uid))
    f.own_food_dates = sorted((date_for(user, c) if c else f.today) for (c,) in own.all())
    serv = await db.execute(select(FoodServing.created_at).where(FoodServing.user_id == uid))
    f.serving_dates = sorted((date_for(user, c) if c else f.today) for (c,) in serv.all())
    return f


# ---------------------------------------------------------------------------
# Streak
# ---------------------------------------------------------------------------

@dataclass
class Streak:
    current: int = 0
    longest: int = 0
    banked: int = FREEZES_START
    states: dict[date, str] = field(default_factory=dict)
    freeze_days: list[date] = field(default_factory=list)
    run_after: dict[date, int] = field(default_factory=dict)
    run_timeline: list[tuple[date, int]] = field(default_factory=list)
    returns: list[date] = field(default_factory=list)
    today_logged: bool = False


def compute_streak(logged: set[date], today: date) -> Streak:
    """A gap of missed days is covered by freezes only when the whole gap fits the banked freezes;
    a longer gap ends the run at once and leaves the banked freezes alone. Today pending changes nothing."""
    st = Streak()
    st.today_logged = today in logged
    days = sorted(d for d in logged if d <= today)
    if not days:
        return st
    banked, run = FREEZES_START, 0

    def log_day(d: date):
        nonlocal banked, run
        if run == 0:
            banked = max(banked, 1)  # every new run starts with a freeze in hand
        run += 1
        st.states[d] = "logged"
        if run % 7 == 0:
            banked = min(FREEZES_MAX, banked + 1)
        if run > st.longest:
            st.longest = run
            st.run_timeline.append((d, run))
        st.run_after[d] = run

    def cover(missed: list[date]):
        nonlocal banked, run
        if not missed:
            return
        if len(missed) <= banked:
            banked -= len(missed)
            for m in missed:
                st.states[m] = "freeze"
                st.freeze_days.append(m)
                st.run_after[m] = run
        else:
            run = 0
            for m in missed:
                st.states[m] = "empty"
                st.run_after[m] = 0

    prev = None
    for d in days:
        if prev is not None:
            gap = (d - prev).days - 1
            if gap >= 3:
                st.returns.append(d)
            cover([prev + timedelta(days=k) for k in range(1, gap + 1)])
        log_day(d)
        prev = d
    if prev < today:
        cover([prev + timedelta(days=k) for k in range(1, (today - prev).days)])
    st.current, st.banked = run, banked
    return st


def next_milestone(current: int) -> int:
    for m in STREAK_MILESTONES:
        if m > current:
            return m
    return (current // 100 + 1) * 100


def strip_of(st: Streak, today: date) -> list[dict]:
    out = []
    for d in _days(today - timedelta(days=13), today):
        if d == today:
            state = "logged" if st.today_logged else "pending"
        else:
            state = st.states.get(d, "empty")
        out.append({"date": d, "state": state})
    return out


# ---------------------------------------------------------------------------
# Day goals
# ---------------------------------------------------------------------------

@dataclass
class Derived:
    """Per-day sets and goal results, computed once from the facts."""

    goals: list[dict]  # resolved: key, target (effective number)
    available: list[dict]
    protein_met: set[date] = field(default_factory=set)
    water_met: set[date] = field(default_factory=set)
    fiber_met: set[date] = field(default_factory=set)
    supps_met: set[date] = field(default_factory=set)
    micro_met: set[date] = field(default_factory=set)
    any_done: set[date] = field(default_factory=set)
    closed: set[date] = field(default_factory=set)
    protein_target: float | None = None
    water_target: float | None = None
    fiber_target: float | None = None


def _set_target(v) -> float | None:
    return float(v) if v is not None and v > 0 else None


def goal_value(key: str, d: date, f: Facts, dv: Derived) -> float:
    if key == "meals":
        return float(len(f.day_meals.get(d, ())))
    if key == "protein":
        return f.day_protein.get(d, 0.0)
    if key == "water":
        return f.day_water.get(d, 0.0)
    if key == "fiber":
        return f.day_fiber.get(d, 0.0)
    return float(len(f.active_supps & f.day_supps.get(d, set())))


def derive(f: Facts, user: User) -> Derived:
    dv = Derived(goals=[], available=[])
    hidden = f.hidden or hidden_of(user)
    dv.protein_target = None if "protein" in hidden else _set_target(user.target_protein_g)
    dv.water_target = None if "water" in hidden else _set_target(user.target_water_ml)
    dv.fiber_target = None if "fiber" in hidden else _set_target(user.target_fiber_g)
    n_supps = len(f.active_supps)

    dv.available = [{"key": "meals", "label": GOAL_INFO["meals"][0], "default_target": float(DEFAULT_MEALS_TARGET)}]
    for key, target in (("protein", dv.protein_target), ("water", dv.water_target), ("fiber", dv.fiber_target)):
        if target is not None:
            dv.available.append({"key": key, "label": GOAL_INFO[key][0], "default_target": target})
    if n_supps:
        dv.available.append({"key": "supplements", "label": GOAL_INFO["supplements"][0], "default_target": float(n_supps)})
    available_keys = {a["key"] for a in dv.available}

    for g in day_goals_of(user):
        if g["key"] not in available_keys or any(x["key"] == g["key"] for x in dv.goals):
            continue
        if g["key"] == "meals":
            target = float(g["target"] or DEFAULT_MEALS_TARGET)
        else:
            target = next(a["default_target"] for a in dv.available if a["key"] == g["key"])
        dv.goals.append({"key": g["key"], "target": target})
    dv.goals = dv.goals[:MAX_DAY_GOALS]

    logged = f.logged
    for d in logged:
        if dv.protein_target and f.day_protein.get(d, 0) >= dv.protein_target:
            dv.protein_met.add(d)
        if dv.fiber_target and f.day_fiber.get(d, 0) >= dv.fiber_target:
            dv.fiber_met.add(d)
        if n_supps and f.active_supps <= f.day_supps.get(d, set()):
            dv.supps_met.add(d)
        if f.micro_targets:
            micros = f.day_micros.get(d, {})
            if all(micros.get(m, 0) >= tv for m, tv in f.micro_targets.items()):
                dv.micro_met.add(d)
        done = [goal_value(g["key"], d, f, dv) >= g["target"] for g in dv.goals]
        if any(done):
            dv.any_done.add(d)
        if done and all(done):
            dv.closed.add(d)
    # Water counts on any day with a water log, logged food or not (a hydration run is not a food run).
    if dv.water_target:
        dv.water_met = {d for d, ml in f.day_water.items() if ml >= dv.water_target and d <= f.today}
    return dv


# ---------------------------------------------------------------------------
# Weight
# ---------------------------------------------------------------------------

def compute_trend(weights: dict[date, float], today: date) -> dict[date, float]:
    """EWMA (alpha 0.1) over consecutive calendar days: carried through days without a weigh-in,
    updated only on days with one, seeded with the first value."""
    trend: dict[date, float] = {}
    if not weights:
        return trend
    t = None
    for d in _days(min(weights), max(today, max(weights))):
        if d in weights:
            t = weights[d] if t is None else t + 0.1 * (weights[d] - t)
        trend[d] = t
    return trend


def weigh_weeks_of(weights: dict[date, float]) -> dict[date, date]:
    """Qualifying ISO weeks (3 or more distinct weigh-in days) -> the date the week qualified."""
    by_week: dict[date, list[date]] = defaultdict(list)
    for d in sorted(weights):
        by_week[monday_of(d)].append(d)
    return {w: days[2] for w, days in by_week.items() if len(days) >= 3}


def _linear_slope(points: list[tuple[int, float]]) -> float | None:
    n = len(points)
    if n < 2:
        return None
    mx = sum(x for x, _ in points) / n
    my = sum(y for _, y in points) / n
    den = sum((x - mx) ** 2 for x, _ in points)
    if den == 0:
        return None
    return sum((x - mx) * (y - my) for x, y in points) / den


def compute_weight(f: Facts, user: User, trend: dict[date, float]) -> dict | None:
    if not f.weights:
        return None
    today = f.today
    t_today = trend[today]
    last_raw_date = max(d for d in f.weights if d <= today) if any(d <= today for d in f.weights) else max(f.weights)

    def change(n: int):
        prev = trend.get(today - timedelta(days=n))
        return round(t_today - prev, 2) if prev is not None else None

    goal = user.target_weight_kg
    direction = None
    if goal is not None:
        if goal < t_today - GOAL_BAND_KG:
            direction = "down"
        elif goal > t_today + GOAL_BAND_KG:
            direction = "up"
        else:
            direction = "reached"

    eta = None
    if goal is not None and direction in ("down", "up"):
        pts = [((d - (today - timedelta(days=27))).days, trend[d]) for d in _days(today - timedelta(days=27), today) if d in trend]
        slope = _linear_slope(pts) if len(pts) >= 7 else None
        if slope is not None and abs(slope) > 0.005 and (goal - t_today) * slope > 0:
            days_away = math.ceil((goal - t_today) / slope)
            if days_away <= ETA_MAX_DAYS:
                eta = today + timedelta(days=days_away)

    window_start = today - timedelta(days=89)
    window_raw = [d for d in f.weights if window_start <= d <= today]
    series = []
    if window_raw:
        for d in _days(min(window_raw), today):
            series.append({"date": d, "raw": round(f.weights[d], 2) if d in f.weights else None, "trend": round(trend[d], 2)})

    is_low = False
    if goal is not None and goal != t_today:
        prev = trend.get(today - timedelta(days=1))
        window = [trend[d] for d in _days(window_start, today) if d in trend]
        if prev is not None and abs(t_today - prev) > 1e-9 and window:
            best = min(window) if goal < t_today else max(window)
            is_low = abs(t_today - best) < 1e-9

    qualifying = weigh_weeks_of(f.weights)
    cur_week = monday_of(today)
    count = 1 if cur_week in qualifying else 0
    w = cur_week - timedelta(weeks=1)
    # The chain ending last week, with the current week on top if it already qualifies.
    while w in qualifying:
        count += 1
        w -= timedelta(weeks=1)
    longest, run, prev_w = 0, 0, None
    for wk in sorted(qualifying):
        run = run + 1 if prev_w is not None and wk - prev_w == timedelta(weeks=1) else 1
        prev_w = wk
        longest = max(longest, run)
    this_week = sum(1 for d in f.weights if cur_week <= d <= today)

    return {
        "trend_kg": round(t_today, 2),
        "raw_kg": round(f.weights[last_raw_date], 2),
        "raw_date": last_raw_date,
        "trend_change_7d": change(7),
        "trend_change_28d": change(28),
        "goal_kg": goal,
        "direction": direction,
        "eta_date": eta,
        "weigh_in_weeks_current": count,
        "weigh_in_weeks_longest": longest,
        "this_week_weigh_ins": this_week,
        "is_trend_low": is_low,
        "series": series,
    }


# ---------------------------------------------------------------------------
# Prints (achievements)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class PrintDef:
    key: str
    area: str
    name: str
    unit: str
    runs: tuple
    describe: callable
    run_title: callable
    hidden: bool = False
    hint: str = ""


def _range(n):
    return tuple(range(1, n + 1))


PRINTS: tuple[PrintDef, ...] = (
    PrintDef("streak", "consistency", "Streak", "days", (7, 30, 100, 200, 365, 500, 1000),
             lambda n: f"Log food {int(n)} days in a row", lambda n: f"{int(n)} day streak"),
    PrintDef("logged_days", "consistency", "Logged days", "days", (50, 100, 250, 365),
             lambda n: f"Log food on {int(n)} different days", lambda n: f"{int(n)} logged days"),
    PrintDef("steady_weeks", "consistency", "Steady weeks", "weeks", (4, 12, 26),
             lambda n: f"Log food on 4 days or more in {_pl(n, 'week')}", lambda n: f"{_pl(n, 'steady week')}"),
    PrintDef("foods_logged", "consistency", "Foods logged", "foods", (100, 1000, 5000),
             lambda n: f"Log {int(n)} foods in total", lambda n: f"{int(n)} foods logged"),
    PrintDef("comeback", "consistency", "Comeback", "returns", (1, 3, 10),
             lambda n: f"Log food again after 3 or more days away, {_pl(n, 'time')}",
             lambda n: "Welcome back" if int(n) == 1 else f"{int(n)} comebacks",
             hidden=True, hint="Some prints appear when you come back."),
    PrintDef("day_closed", "consistency", "Closed days", "days", (1, 7, 30, 100),
             lambda n: f"Close {_pl(n, 'day')}", lambda n: f"{_pl(n, 'day')} closed"),
    PrintDef("quests_weeks", "consistency", "Quest weeks", "weeks", (1, 4, 12, 26),
             lambda n: f"Finish every quest of a week, {_pl(n, 'time')}", lambda n: f"{_pl(n, 'quest week')}"),
    PrintDef("week_variety", "variety", "Variety week", "foods", (15, 25, 35),
             lambda n: f"Log {int(n)} different foods in one week", lambda n: f"{int(n)} foods in a week"),
    PrintDef("new_foods", "variety", "New foods", "foods", (25, 100, 250),
             lambda n: f"Try {int(n)} different foods", lambda n: f"{int(n)} foods tried"),
    PrintDef("protein_weeks", "protein", "Protein weeks", "weeks", (1, 4, 12),
             lambda n: f"Protein target on 5 of 7 days, in {_pl(n, 'week')}", lambda n: _pl(n, "protein week")),
    PrintDef("water_run", "hydration", "Water streak", "days", (7, 30, 100),
             lambda n: f"Reach your water target {int(n)} days in a row", lambda n: f"{int(n)} day water streak"),
    PrintDef("micro_days", "micros", "Full nutrients", "days", (1, 7, 30),
             lambda n: f"Meet every micronutrient target on {_pl(n, 'day')}", lambda n: f"{_pl(n, 'full nutrient day')}"),
    PrintDef("full_plate", "micros", "Full plate", "days", (1,),
             lambda n: "Meet your protein, fiber, water and micronutrient targets in one day", lambda n: "Full plate",
             hidden=True, hint="Some days everything lines up."),
    PrintDef("weigh_weeks", "body", "Weigh-in weeks", "weeks", (4, 12, 26, 52),
             lambda n: f"Weigh in on 3 days or more for {int(n)} weeks in a row", lambda n: f"{int(n)} weigh-in weeks"),
    PrintDef("trend_kg", "body", "Trend kilos", "kg", _range(50),
             lambda n: f"Move your trend weight {int(n)} kg toward your goal", lambda n: f"{int(n)} kg toward your goal"),
    PrintDef("goal_reached", "body", "Goal reached", "goal", (1,),
             lambda n: "Bring your trend weight to your goal", lambda n: "Goal reached"),
    PrintDef("barcodes", "kitchen", "Barcodes", "foods", (10, 50, 200),
             lambda n: f"Log {int(n)} different foods with a barcode", lambda n: f"{int(n)} barcodes"),
    PrintDef("own_foods", "kitchen", "Own foods", "foods", (5, 25, 100),
             lambda n: f"Save {int(n)} foods of your own", lambda n: f"{int(n)} own foods"),
    PrintDef("named_servings", "kitchen", "Named servings", "servings", (5, 20),
             lambda n: f"Save {int(n)} named servings", lambda n: f"{int(n)} named servings"),
    PrintDef("supplements_run", "supplements", "Supplement streak", "days", (7, 30, 100),
             lambda n: f"Take all your supplements {int(n)} days in a row", lambda n: f"{int(n)} day supplement streak"),
)
HIDEABLE_PRINTS = {"water_run": "water", "protein_weeks": "protein"}
PRINT_BY_KEY = {p.key: p for p in PRINTS}
BIG_STREAK = 100
ALWAYS_BIG = {"goal_reached", "full_plate", "quests_weeks"}


@dataclass
class Metric:
    timeline: list  # (date, running value), value never decreases
    value: float


def _cum(dates: list[date]) -> Metric:
    ds = sorted(dates)
    return Metric([(d, i + 1) for i, d in enumerate(ds)], float(len(ds)))


def _run_metric(days) -> Metric:
    tl, best, run, prev = [], 0, 0, None
    for d in sorted(days):
        run = run + 1 if prev is not None and d - prev == timedelta(days=1) else 1
        prev = d
        if run > best:
            best = run
            tl.append((d, best))
    return Metric(tl, float(best))


def _first_reach(m: Metric, threshold: float) -> date | None:
    for d, v in m.timeline:
        if v >= threshold:
            return d
    return None


def _week_variety(f: Facts) -> Metric:
    by_week: dict[date, list[date]] = defaultdict(list)
    for d in f.day_foods:
        if d <= f.today:
            by_week[monday_of(d)].append(d)
    tl, best = [], 0
    events = []
    for days in by_week.values():
        seen: set = set()
        for d in sorted(days):
            seen |= f.day_foods[d]
            events.append((d, len(seen)))
    for d, n in sorted(events):
        if n > best:
            best = n
            tl.append((d, n))
    return Metric(tl, float(best))


def _trend_metrics(f: Facts, goal, trend: dict[date, float]) -> tuple[Metric | None, Metric | None, str | None]:
    if goal is None or not trend:
        return None, None, None
    days = sorted(d for d in trend if d <= f.today)
    side = "loss" if trend[days[0]] > goal else "gain"
    start_trend = trend[days[0]]
    run_ext = start_trend
    best, kg_tl = 0.0, []
    was_outside, reached_on = False, None
    for d in days:
        t = trend[d]
        if side == "loss":
            run_ext = max(run_ext, t)
            progress = run_ext - t
            outside, inside = t > goal + GOAL_BAND_KG, t <= goal + GOAL_BAND_KG
        else:
            run_ext = min(run_ext, t)
            progress = t - run_ext
            outside, inside = t < goal - GOAL_BAND_KG, t >= goal - GOAL_BAND_KG
        progress = min(progress, abs(start_trend - goal))
        if progress > best:
            best = progress
            kg_tl.append((d, best))
        if outside:
            was_outside = True
        if reached_on is None and was_outside and inside:
            reached_on = d
    reached = Metric([(reached_on, 1)] if reached_on else [], 1.0 if reached_on else 0.0)
    return Metric(kg_tl, best), reached, side


def compute_metrics(f: Facts, dv: Derived, st: Streak, trend: dict, goal, quest_rows: list) -> dict[str, Metric | None]:
    m: dict[str, Metric | None] = {}
    m["streak"] = Metric(list(st.run_timeline), float(st.longest))

    day_counts = sorted(f.day_logs.items())
    total, tl = 0, []
    for d, n in day_counts:
        if d > f.today:
            continue
        total += n
        tl.append((d, total))
    m["foods_logged"] = Metric(tl, float(total))

    m["comeback"] = _cum(st.returns)
    logged_sorted = sorted(f.logged)
    m["logged_days"] = _cum(logged_sorted)
    by_week_l: dict[date, list[date]] = defaultdict(list)
    for d in logged_sorted:
        by_week_l[monday_of(d)].append(d)
    m["steady_weeks"] = _cum([days[3] for days in by_week_l.values() if len(days) >= 4])
    m["week_variety"] = _week_variety(f)
    m["new_foods"] = _cum([d for d in f.first_logged.values() if d <= f.today])

    if dv.protein_target:
        by_week: dict[date, list[date]] = defaultdict(list)
        for d in sorted(dv.protein_met):
            by_week[monday_of(d)].append(d)
        m["protein_weeks"] = _cum([days[4] for days in by_week.values() if len(days) >= 5])
    else:
        m["protein_weeks"] = None

    m["water_run"] = _run_metric(dv.water_met) if dv.water_target else None
    m["micro_days"] = _cum(list(dv.micro_met)) if f.micro_targets else None

    if f.micro_targets:
        checks = [(dv.protein_met, dv.protein_target), (dv.water_met, dv.water_target), (dv.fiber_met, dv.fiber_target)]
        set_checks = [s for s, t in checks if t]
        if len(set_checks) >= 2:
            days = set(dv.micro_met)
            for s in set_checks:
                days &= s
            m["full_plate"] = _cum(list(days))
        else:
            m["full_plate"] = None
    else:
        m["full_plate"] = None

    m["day_closed"] = _cum(list(dv.closed))

    ww = weigh_weeks_of(f.weights)
    tl, best, run, prev = [], 0, 0, None
    for wk in sorted(ww):
        run = run + 1 if prev is not None and wk - prev == timedelta(weeks=1) else 1
        prev = wk
        if run > best:
            best = run
            tl.append((ww[wk], best))
    m["weigh_weeks"] = Metric(tl, float(best))

    kg, reached, _side = _trend_metrics(f, goal, trend)
    m["trend_kg"], m["goal_reached"] = kg, reached

    barcode_dates = [f.first_logged[x] for x in f.barcode_foods if x in f.first_logged and f.first_logged[x] <= f.today]
    m["barcodes"] = _cum(barcode_dates)
    m["own_foods"] = _cum(f.own_food_dates)
    m["named_servings"] = _cum(f.serving_dates)

    if f.active_supps:
        m["supplements_run"] = _run_metric(dv.supps_met)
    else:
        m["supplements_run"] = None

    by_week_q: dict[date, list] = defaultdict(list)
    for q in quest_rows:
        by_week_q[q.week_start].append(q)
    qdates = [max(q.done_at for q in qs) for qs in by_week_q.values() if len(qs) >= 3 and all(q.done_at for q in qs)]
    m["quests_weeks"] = _cum(qdates)
    return m


# ---------------------------------------------------------------------------
# Weekly quests
# ---------------------------------------------------------------------------

QUESTS = {
    # key: (area, title)
    "protein_days": ("protein", lambda n: f"Reach your protein target on {_pl(n, 'day')}"),
    "water_days": ("hydration", lambda n: f"Reach your water target on {_pl(n, 'day')}"),
    "fiber_days": ("variety", lambda n: f"Reach your fiber target on {_pl(n, 'day')}"),
    "new_foods": ("variety", lambda n: f"Try {_pl(n, 'new food')}"),
    "distinct_foods": ("variety", lambda n: f"Log {_pl(n, 'different food')}"),
    "log_days": ("consistency", lambda n: f"Log food on {_pl(n, 'day')}"),
    "weigh_ins": ("body", lambda n: f"Weigh in on {_pl(n, 'day')}"),
    "supplements_days": ("supplements", lambda n: f"Take all your supplements on {_pl(n, 'day')}"),
    "closed_days": ("consistency", lambda n: f"Close {_pl(n, 'day')}"),
}


def _clamp(v, lo, hi):
    return max(lo, min(hi, v))


def quest_series(key: str, ws: date, f: Facts, dv: Derived) -> list[tuple[date, int]]:
    """Cumulative progress at the end of each day of the week up to today."""
    out, total, seen = [], 0, set()
    first_counts = Counter(f.first_logged.values())
    for d in _days(ws, min(ws + timedelta(days=6), f.today)):
        if key == "protein_days":
            total += d in dv.protein_met
        elif key == "water_days":
            total += d in dv.water_met
        elif key == "fiber_days":
            total += d in dv.fiber_met
        elif key == "supplements_days":
            total += d in dv.supps_met
        elif key == "closed_days":
            total += d in dv.closed
        elif key == "log_days":
            total += d in f.day_logs
        elif key == "weigh_ins":
            total += d in f.weights
        elif key == "distinct_foods":
            seen |= f.day_foods.get(d, set())
            total = len(seen)
        elif key == "new_foods":
            total += first_counts.get(d, 0)
        out.append((d, total))
    return out


def _week_count(key: str, ws: date, f: Facts, dv: Derived) -> int:
    series = quest_series(key, ws, f, dv) if ws <= f.today else []
    # A full past week: today does not cut it short.
    return series[-1][1] if series else 0


def eligible_quests(user: User, f: Facts, dv: Derived, ws: date) -> dict[str, int]:
    last = ws - timedelta(weeks=1)
    out: dict[str, int] = {}
    if dv.protein_target:
        out["protein_days"] = _clamp(_week_count("protein_days", last, f, dv) + 1, 3, 6)
    if dv.water_target:
        out["water_days"] = _clamp(_week_count("water_days", last, f, dv) + 1, 3, 6)
    if dv.fiber_target:
        out["fiber_days"] = _clamp(_week_count("fiber_days", last, f, dv) + 1, 3, 6)
    out["new_foods"] = 3
    out["distinct_foods"] = _clamp(_week_count("distinct_foods", last, f, dv) + 3, 15, 40)
    last_logged = _week_count("log_days", last, f, dv)
    if last_logged < 7:
        out["log_days"] = _clamp(last_logged + 1, 3, 7)
    if f.weights:
        out["weigh_ins"] = 3
    if f.active_supps:
        out["supplements_days"] = _clamp(_week_count("supplements_days", last, f, dv) + 1, 3, 7)
    out["closed_days"] = _clamp(_week_count("closed_days", last, f, dv) + 1, 2, 6)
    return out


def _pick_quests(user: User, ws: date, pool: dict[str, int], n: int, exclude_areas: set[str] = frozenset(), salt: str = ""):
    rng = random.Random(f"{user.id}:{ws.isoformat()}:{salt}")
    keys = sorted(pool)
    rng.shuffle(keys)
    chosen, areas = [], set(exclude_areas)
    for k in keys:  # different areas first
        if len(chosen) < n and QUESTS[k][0] not in areas:
            chosen.append(k)
            areas.add(QUESTS[k][0])
    for k in keys:
        if len(chosen) < n and k not in chosen:
            chosen.append(k)
    return chosen


def quest_meta(q: WeeklyQuest) -> tuple[str, str]:
    area, title = QUESTS.get(q.key, ("consistency", lambda n: q.key))
    return area, title(q.target)


def quest_item(q: WeeklyQuest, f: Facts, dv: Derived) -> dict:
    area, title = quest_meta(q)
    series = quest_series(q.key, q.week_start, f, dv)
    progress = series[-1][1] if series else 0
    return {
        "id": q.id, "key": q.key, "title": title, "target": q.target,
        "progress": min(progress, q.target), "done": q.done_at is not None, "area": area,
    }


async def _sync_quests(db: AsyncSession, user: User, f: Facts, dv: Derived, enabled: bool) -> list[WeeklyQuest]:
    ws = monday_of(f.today)
    rows = (await db.execute(select(WeeklyQuest).where(WeeklyQuest.user_id == user.id))).scalars().all()
    current = [q for q in rows if q.week_start == ws]
    if not current and enabled:
        pool = eligible_quests(user, f, dv, ws)
        for key in _pick_quests(user, ws, pool, 3):
            q = WeeklyQuest(id=uuid.uuid4(), user_id=user.id, week_start=ws, key=key, target=pool[key], swapped=False)
            db.add(q)
            rows.append(q)
            current.append(q)
    for q in current:
        if q.done_at is None:
            for d, v in quest_series(q.key, ws, f, dv):
                if v >= q.target:
                    q.done_at = d
                    break
    return rows


async def swap_quest(db: AsyncSession, user: User, quest_id: uuid.UUID) -> dict:
    f = await load_facts(db, user)
    dv = derive(f, user)
    ws = monday_of(f.today)
    rows = (await db.execute(select(WeeklyQuest).where(WeeklyQuest.user_id == user.id, WeeklyQuest.week_start == ws))).scalars().all()
    quest = next((q for q in rows if q.id == quest_id), None)
    if quest is None:
        raise HTTPException(status_code=404, detail={"detail": "Quest not found", "code": "QUEST_NOT_FOUND"})
    if quest.done_at is not None:
        # A finished quest stays finished; swapping it would throw the win away.
        raise HTTPException(status_code=409, detail={"detail": "This quest is already done", "code": "QUEST_DONE"})
    if any(q.swapped for q in rows):
        raise HTTPException(status_code=409, detail={"detail": "Already swapped this week", "code": "SWAP_USED"})
    pool = eligible_quests(user, f, dv, ws)
    present = {q.key for q in rows}
    pool = {k: v for k, v in pool.items() if k not in present}
    if not pool:
        raise HTTPException(status_code=409, detail={"detail": "No other quest fits", "code": "NO_ALTERNATIVE"})
    other_areas = {QUESTS[q.key][0] for q in rows if q.id != quest.id and q.key in QUESTS}
    new_key = _pick_quests(user, ws, pool, 1, exclude_areas=other_areas, salt=f"swap:{quest.key}")[0]
    quest.key, quest.target = new_key, pool[new_key]
    quest.swapped, quest.done_at, quest.seen_at = True, None, None
    for d, v in quest_series(new_key, ws, f, dv):
        if v >= quest.target:
            quest.done_at = d
            break
    await db.commit()
    return quest_item(quest, f, dv)


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------

@dataclass
class Evaluation:
    user: User
    facts: Facts
    derived: Derived
    streak: Streak
    trend: dict
    weight: dict | None
    metrics: dict
    achievements: list
    quests: list
    settings: dict
    state: dict


async def _insert_new(db: AsyncSession, rows: list[Achievement]) -> list[Achievement]:
    if not rows:
        return rows
    try:
        async with db.begin_nested():
            db.add_all(rows)
            await db.flush()
        return rows
    except IntegrityError:
        stored = []
        for r in rows:
            try:
                async with db.begin_nested():
                    fresh = Achievement(
                        id=uuid.uuid4(), user_id=r.user_id, key=r.key, run=r.run, earned_at=r.earned_at, context=r.context
                    )
                    db.add(fresh)
                    await db.flush()
                stored.append(fresh)
            except IntegrityError:
                continue
        return stored


async def evaluate(db: AsyncSession, user: User) -> Evaluation:
    f = await load_facts(db, user)
    dv = derive(f, user)
    st = compute_streak(f.logged, f.today)
    trend = compute_trend(f.weights, f.today)
    weight = compute_weight(f, user, trend)
    settings = game_settings_of(user)
    state = dict(user.game_state or {})

    quests = await _sync_quests(db, user, f, dv, settings["enabled"])
    metrics = compute_metrics(f, dv, st, trend, user.target_weight_kg, quests)

    existing = (await db.execute(select(Achievement).where(Achievement.user_id == user.id))).scalars().all()
    have = {(a.key, a.run) for a in existing}
    backfill = not state.get("backfilled")
    new_rows = []
    for p in PRINTS:
        met = metrics.get(p.key)
        if met is None:
            continue
        for i, threshold in enumerate(p.runs, start=1):
            if (p.key, i) in have or met.value < threshold:
                continue
            earned = _first_reach(met, threshold)
            if earned is None:
                continue
            new_rows.append(Achievement(
                id=uuid.uuid4(), user_id=user.id, key=p.key, run=i, earned_at=earned,
                context={"backfill": True} if backfill else None,
            ))
    achievements = list(existing) + await _insert_new(db, new_rows)
    if backfill:
        state["backfilled"] = True
        user.game_state = state
    await db.commit()
    return Evaluation(user, f, dv, st, trend, weight, metrics, achievements, quests, settings, state)


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def is_big(key: str, run: int, threshold: float) -> bool:
    p = PRINT_BY_KEY[key]
    if key in ALWAYS_BIG:
        return True
    if key == "streak" and threshold >= BIG_STREAK:
        return True
    return len(p.runs) > 1 and run >= 2


def _print_out(p: PrintDef, ev: Evaluation) -> dict | None:
    earned = {a.run: a.earned_at for a in ev.achievements if a.key == p.key}
    met = ev.metrics.get(p.key)
    if met is None and not earned:
        return None
    any_earned = bool(earned)
    next_run = next((i for i in range(1, len(p.runs) + 1) if i not in earned), None)
    next_thr = p.runs[next_run - 1] if next_run else None
    if p.hidden and not any_earned:
        return {
            "key": p.key, "area": p.area, "title": "Hidden print", "description": p.hint, "hidden": True, "unit": p.unit,
            "runs": [{"run": i, "threshold": float(t), "earned_at": None} for i, t in enumerate(p.runs, start=1)],
            "progress": None,
        }
    if p.key == "trend_kg":
        shown = [i for i in range(1, len(p.runs) + 1) if i in earned or i == next_run]
    else:
        shown = list(range(1, len(p.runs) + 1))
    value = met.value if met is not None else float(max((p.runs[r - 1] for r in earned), default=0))
    desc_n = next_thr if next_thr is not None else p.runs[-1]
    return {
        "key": p.key, "area": p.area, "title": p.name, "description": p.describe(desc_n), "hidden": p.hidden, "unit": p.unit,
        "runs": [{"run": i, "threshold": float(p.runs[i - 1]), "earned_at": earned.get(i)} for i in shown],
        "progress": {"value": round(value, 2), "next_threshold": float(next_thr) if next_thr is not None else None},
    }


def day_goal_items(ev: Evaluation) -> list[dict]:
    f, dv, today = ev.facts, ev.derived, ev.facts.today
    out = []
    for g in dv.goals:
        value = goal_value(g["key"], today, f, dv)
        label, unit = GOAL_INFO[g["key"]]
        out.append({
            "key": g["key"], "label": label, "target": g["target"], "value": round(value, 1),
            "unit": unit, "done": value >= g["target"],
        })
    return out


def quest_items(ev: Evaluation) -> tuple[list[dict], bool]:
    ws = monday_of(ev.facts.today)
    current = [q for q in ev.quests if q.week_start == ws]
    items = [quest_item(q, ev.facts, ev.derived) for q in sorted(current, key=lambda q: (q.created_at or datetime.min, str(q.id)))]
    swap = bool(current) and not any(q.swapped for q in current)
    if swap:
        pool = eligible_quests(ev.user, ev.facts, ev.derived, ws)
        swap = any(k not in {q.key for q in current} for k in pool)
    return items, swap


def year_levels(ev: Evaluation) -> list[dict]:
    f, dv = ev.facts, ev.derived
    out = []
    for d in _days(f.today - timedelta(days=364), f.today):
        if d not in f.day_logs:
            level = 0
        elif d in dv.closed:
            level = 3
        elif d in dv.any_done:
            level = 2
        else:
            level = 1
        out.append({"date": d, "level": level})
    return out


def _print_hidden(ev: Evaluation, key: str) -> bool:
    return HIDEABLE_PRINTS.get(key) in ev.facts.hidden


def _seen_through(ev: Evaluation, name: str) -> date | None:
    raw = (ev.state or {}).get(name)
    return date.fromisoformat(raw) if raw else None


def _unseen(ev: Evaluation) -> list[dict]:
    out = []
    for a in ev.achievements:
        if a.seen_at is not None or a.key not in PRINT_BY_KEY or _print_hidden(ev, a.key):
            continue
        p = PRINT_BY_KEY[a.key]
        threshold = p.runs[a.run - 1] if a.run - 1 < len(p.runs) else a.run
        out.append({
            "kind": "print", "id": None, "key": a.key, "run": a.run, "title": p.run_title(threshold),
            "description": p.describe(threshold), "area": p.area, "date": a.earned_at,
            "big": is_big(a.key, a.run, threshold), "backfill": bool((a.context or {}).get("backfill")),
        })
    out.sort(key=lambda u: (u["date"], u["key"], u["run"]))
    for q in ev.quests:
        if q.done_at is not None and q.seen_at is None:
            area, title = quest_meta(q)
            out.append({
                "kind": "quest", "id": str(q.id), "key": q.key, "run": None, "title": title,
                "description": "Weekly quest done", "area": area, "date": q.done_at, "big": False, "backfill": False,
            })
    seen_through = _seen_through(ev, "freeze_seen_through")
    today = ev.facts.today
    # The user may still backfill yesterday, so a freeze only counts once it is two days old.
    for d in ev.streak.freeze_days:
        if today - timedelta(days=6) <= d <= today - timedelta(days=2) and (seen_through is None or d > seen_through):
            out.append({
                "kind": "freeze", "id": None, "key": "freeze", "run": None, "title": "Streak freeze used",
                "description": "A freeze covered a day without food. Your streak goes on.",
                "area": None, "date": d, "big": False, "backfill": False,
            })
    if ev.streak.returns:
        latest = ev.streak.returns[-1]
        back_seen = _seen_through(ev, "comeback_seen_through")
        if latest >= today - timedelta(days=1) and (back_seen is None or latest > back_seen):
            out.append({
                "kind": "comeback", "id": None, "key": "comeback", "run": None, "title": "Welcome back",
                "description": "Today starts a new streak.", "area": "consistency", "date": latest,
                "big": False, "backfill": False,
            })
    return out


def recap_week_available(ev: Evaluation) -> date | None:
    last = monday_of(ev.facts.today) - timedelta(weeks=1)
    if not any(last <= d <= last + timedelta(days=6) for d in ev.facts.logged):
        return None
    if (ev.state or {}).get("recap_seen_week") == last.isoformat():
        return None
    return last


def build_game_response(ev: Evaluation) -> dict:
    s, today = ev.settings, ev.facts.today
    items, swap = quest_items(ev)
    goals = day_goal_items(ev)
    return {
        "enabled": s["enabled"], "show_streak": s["show_streak"], "celebrations": s["celebrations"],
        "today": today,
        "streak": {
            "current": ev.streak.current, "longest": ev.streak.longest, "freezes_banked": ev.streak.banked,
            "freezes_max": FREEZES_MAX, "today_logged": ev.streak.today_logged,
            "next_milestone": next_milestone(ev.streak.current), "strip": strip_of(ev.streak, today),
        },
        "day_goals": goals,
        "day_closed": bool(goals) and all(g["done"] for g in goals) and today in ev.facts.day_logs,
        "available_goals": ev.derived.available,
        "weight": ev.weight,
        "prints": [o for o in (_print_out(p, ev) for p in PRINTS if not _print_hidden(ev, p.key)) if o is not None],
        "unseen": _unseen(ev),
        "quests": {"week_start": monday_of(today), "swap_available": swap, "items": items},
        "year": year_levels(ev),
        "recap_available": recap_week_available(ev),
    }


def agent_summary(ev: Evaluation) -> dict:
    items, _ = quest_items(ev)
    recent = sorted(ev.achievements, key=lambda a: (a.earned_at, a.created_at or datetime.min), reverse=True)
    prints = []
    for a in recent:
        p = PRINT_BY_KEY.get(a.key)
        if p is None or _print_hidden(ev, a.key):
            continue
        prints.append({"key": a.key, "run": a.run, "title": p.run_title(p.runs[a.run - 1]), "earned_at": a.earned_at})
        if len(prints) == 5:
            break
    return {
        "streak_current": ev.streak.current, "streak_longest": ev.streak.longest,
        "freezes_banked": ev.streak.banked, "next_milestone": next_milestone(ev.streak.current),
        "day_goals": day_goal_items(ev), "quests": items, "recent_prints": prints,
    }


# ---------------------------------------------------------------------------
# Seen markers and the weekly recap
# ---------------------------------------------------------------------------

async def mark_seen(db: AsyncSession, user: User, body) -> None:
    now = datetime.now(UTC)
    today = today_for(user)
    state = dict(user.game_state or {})
    if body.all:
        rows = (await db.execute(select(Achievement).where(Achievement.user_id == user.id, Achievement.seen_at.is_(None)))).scalars().all()
        quests = (await db.execute(select(WeeklyQuest).where(WeeklyQuest.user_id == user.id, WeeklyQuest.seen_at.is_(None)))).scalars().all()
        for r in (*rows, *quests):
            r.seen_at = now
        through = today
        back_through = today
    else:
        if body.prints:
            wanted = {(p.key, p.run) for p in body.prints}
            rows = (await db.execute(select(Achievement).where(Achievement.user_id == user.id, Achievement.seen_at.is_(None)))).scalars().all()
            for r in rows:
                if (r.key, r.run) in wanted:
                    r.seen_at = now
        if body.quests:
            quests = (await db.execute(
                select(WeeklyQuest).where(WeeklyQuest.user_id == user.id, WeeklyQuest.id.in_(body.quests))
            )).scalars().all()
            for q in quests:
                if q.seen_at is None:
                    q.seen_at = now
        through = body.freezes_through
        back_through = body.comeback_through
    if through is not None:
        prev = state.get("freeze_seen_through")
        if prev is None or date.fromisoformat(prev) < through:
            state["freeze_seen_through"] = through.isoformat()
    if back_through is not None:
        prev = state.get("comeback_seen_through")
        if prev is None or date.fromisoformat(prev) < back_through:
            state["comeback_seen_through"] = back_through.isoformat()
    user.game_state = state
    await db.commit()


async def mark_recap_seen(db: AsyncSession, user: User, week: date) -> None:
    state = dict(user.game_state or {})
    state["recap_seen_week"] = monday_of(week).isoformat()
    user.game_state = state
    await db.commit()


def build_recap(ev: Evaluation, week: date | None) -> dict:
    f, dv, st = ev.facts, ev.derived, ev.streak
    ws = monday_of(week) if week else monday_of(f.today) - timedelta(weeks=1)
    we = ws + timedelta(days=6)
    days = [d for d in _days(ws, we) if d <= f.today]
    logged_days = [d for d in days if d in f.day_logs]

    def best(by_day: dict, only: list[date]):
        top = None
        for d in only:
            v = by_day.get(d, 0)
            if v > 0 and (top is None or v > top[1]):
                top = (d, v)
        return {"date": top[0], "value": round(float(top[1]), 1)} if top else None

    foods: set = set()
    for d in days:
        foods |= f.day_foods.get(d, set())
    quest_rows = [q for q in ev.quests if q.week_start == ws]
    quests = []
    for q in sorted(quest_rows, key=lambda q: (q.created_at or datetime.min, str(q.id))):
        item = quest_item(q, f, dv)
        quests.append({k: item[k] for k in ("key", "title", "target", "progress", "done")})

    prints = []
    for a in sorted(ev.achievements, key=lambda a: (a.earned_at, a.key, a.run)):
        p = PRINT_BY_KEY.get(a.key)
        if p is not None and not _print_hidden(ev, a.key) and ws <= a.earned_at <= we:
            prints.append({"key": a.key, "run": a.run, "title": p.run_title(p.runs[a.run - 1]), "area": p.area})

    end_day = min(we, f.today)
    before = ev.trend.get(ws - timedelta(days=1))
    if before is None:
        first_in = next((d for d in days if d in f.weights), None)
        before = ev.trend.get(first_in) if first_in else None
    after = ev.trend.get(end_day)
    if after is not None and end_day < min(f.weights, default=end_day):
        after = None
    change = round(after - before, 2) if before is not None and after is not None else None

    goal = ev.user.target_weight_kg
    toward = None
    if goal is not None and before is not None and after is not None:
        toward = abs(after - goal) < abs(before - goal)
    week_days = [{"date": d, "logged": d in f.logged, "closed": d in dv.closed} for d in _days(ws, we)]

    varied = {d: len(f.day_foods.get(d, ())) for d in days}
    return {
        "week_start": ws,
        "logged_days": len(logged_days),
        "closed_days": sum(1 for d in days if d in dv.closed) if dv.goals else None,
        "quests": quests,
        "prints": prints,
        "trend_start": round(before, 2) if before is not None else None,
        "trend_end": round(after, 2) if after is not None else None,
        "trend_change": change,
        "weigh_in_days": sum(1 for d in days if d in f.weights),
        "best_protein_day": best(f.day_protein, days),
        "most_varied_day": best(varied, days),
        "distinct_foods": len(foods),
        "water_target_days": sum(1 for d in days if d in dv.water_met) if dv.water_target else None,
        "trend_toward_goal": toward,
        "days": week_days,
        "streak_at_end": st.run_after.get(end_day, 0),
    }
