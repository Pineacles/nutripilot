"""Weight-loss coaching math for the agent: smoothed weight trend, rate of change, an estimate
of what the user really burns (TDEE) and BMR. The functions at the top are pure so they can be
unit tested; ``get_progress`` at the bottom reads the database and assembles the response."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.food_log import FoodLog
from app.models.nutrient import Nutrient
from app.models.user import User
from app.models.weight_log import WeightLog
from app.schemas.progress import IntakeStats, ProgressResponse, ProgressTargets, TrendPoint
from app.services.clock import today_for

TREND_ALPHA = 0.1  # smoothing per day: a day's weigh-in moves the trend by 10 %
KCAL_PER_KG = 7700
RATE_SPAN_DAYS = 14
TDEE_MIN_LOGGED_DAYS = 14
TDEE_MIN_WEIGH_IN_DAYS = 8

ACTIVITY_FACTORS = {
    "sedentary": 1.2, "light": 1.375, "moderate": 1.55, "active": 1.725, "very_active": 1.9,
}


@dataclass(frozen=True)
class TrendDay:
    date: date
    weight_kg: float | None  # None on days without a weigh-in
    trend_kg: float


def daily_weights(entries: list[tuple[date, float]]) -> dict[date, float]:
    """One weight per day: several weigh-ins on a day are averaged."""
    by_day: dict[date, list[float]] = defaultdict(list)
    for day, kg in entries:
        by_day[day].append(kg)
    return {day: sum(v) / len(v) for day, v in by_day.items()}


def smooth_trend(daily: dict[date, float], end: date, alpha: float = TREND_ALPHA) -> list[TrendDay]:
    """Exponentially smoothed weight, one point per day from the first weigh-in to ``end``.

    The trend starts at the first weigh-in. A day without a weigh-in keeps the previous trend.
    Weigh-ins after ``end`` are ignored. Empty when there is no weigh-in on or before ``end``.
    """
    days = sorted(d for d in daily if d <= end)
    if not days:
        return []
    points: list[TrendDay] = []
    trend = daily[days[0]]
    day = days[0]
    while day <= end:
        weight = daily.get(day)
        if weight is not None and day != days[0]:
            trend = trend + alpha * (weight - trend)
        points.append(TrendDay(day, weight, trend))
        day += timedelta(days=1)
    return points


def weekly_rate(points: list[TrendDay], span_days: int = RATE_SPAN_DAYS) -> tuple[float | None, float | None]:
    """(kg per week, percent of the current trend per week) over the last ``span_days`` of the trend.

    None when the span holds fewer than 2 weigh-ins."""
    if not points:
        return None, None
    last = points[-1]
    start = last.date - timedelta(days=span_days)
    span = [p for p in points if p.date >= start]
    if sum(1 for p in span if p.weight_kg is not None) < 2:
        return None, None
    elapsed = (last.date - span[0].date).days
    if elapsed <= 0:
        return None, None
    kg_week = (last.trend_kg - span[0].trend_kg) / elapsed * 7
    return kg_week, kg_week / last.trend_kg * 100


def tdee_confidence(logged_days: int) -> str | None:
    # Today never counts, so a 28-day window holds at most 27 finished days.
    if logged_days >= 26:
        return "high"
    if logged_days >= 21:
        return "medium"
    if logged_days >= TDEE_MIN_LOGGED_DAYS:
        return "low"
    return None


def estimate_tdee(
    avg_kcal: float | None, logged_days: int, weigh_in_days: int, trend_change_kg: float | None, elapsed_days: int
) -> tuple[float | None, str | None]:
    """(TDEE estimate in kcal, confidence): what was eaten minus what the trend stored or released.

    Needs enough logged days and weigh-in days, else (None, None). ``trend_change_kg`` is the trend's change
    over ``elapsed_days`` (the window, or less when the first weigh-in came later)."""
    if (
        avg_kcal is None or trend_change_kg is None or elapsed_days <= 0
        or logged_days < TDEE_MIN_LOGGED_DAYS or weigh_in_days < TDEE_MIN_WEIGH_IN_DAYS
    ):
        return None, None
    return avg_kcal - trend_change_kg * KCAL_PER_KG / elapsed_days, tdee_confidence(logged_days)


def bmr_mifflin_st_jeor(weight_kg: float, height_cm: float, age_years: int, sex: str) -> float | None:
    """Resting energy in kcal/day, None unless ``sex`` is 'male' or 'female'."""
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age_years
    if sex == "male":
        return base + 5
    if sex == "female":
        return base - 161
    return None


def safe_floor_kcal(bmr: float | None, sex: str | None) -> float:
    """Lowest daily target the agent should suggest: BMR, but never under 1500 (men) or 1200 (women, unknown)."""
    return max(bmr or 0, 1500 if sex == "male" else 1200)


def _round(value: float | None, digits: int = 1) -> float | None:
    return None if value is None else round(value, digits)


async def get_progress(db: AsyncSession, user: User, days: int) -> ProgressResponse:
    end = today_for(user)
    start = end - timedelta(days=days - 1)

    weights = (
        await db.execute(
            select(WeightLog.date, WeightLog.weight_kg).where(
                WeightLog.user_id == user.id, WeightLog.date >= start, WeightLog.date <= end
            )
        )
    ).all()
    daily = daily_weights([(r.date, r.weight_kg) for r in weights])
    points = smooth_trend(daily, end)
    latest_trend = points[-1].trend_kg if points else None
    rate_kg, rate_pct = weekly_rate(points)

    ratio = FoodLog.quantity_g / 100.0
    intake_rows = (
        await db.execute(
            select(
                FoodLog.date,
                func.sum(ratio * func.coalesce(Nutrient.kcal, 0)).label("kcal"),
                func.sum(ratio * func.coalesce(Nutrient.protein, 0)).label("protein"),
            )
            .outerjoin(Nutrient, Nutrient.food_id == FoodLog.food_id)
            # Today is still being eaten: counting it would pull the average and the TDEE down.
            .where(FoodLog.user_id == user.id, FoodLog.date >= start, FoodLog.date < end)
            .group_by(FoodLog.date)
        )
    ).all()
    logged_days = len(intake_rows)
    avg_kcal = sum(r.kcal for r in intake_rows) / logged_days if logged_days else None
    avg_protein = sum(r.protein for r in intake_rows) / logged_days if logged_days else None

    tdee, confidence = None, None
    if points:
        tdee, confidence = estimate_tdee(
            avg_kcal, logged_days, len(daily), points[-1].trend_kg - points[0].trend_kg, (end - points[0].date).days
        )

    bmr = None
    if latest_trend is not None and user.height_cm and user.birth_year and user.sex:
        bmr = bmr_mifflin_st_jeor(latest_trend, user.height_cm, end.year - user.birth_year, user.sex)
    factor = ACTIVITY_FACTORS.get(user.activity_level or "")

    return ProgressResponse(
        days=days,
        trend=[TrendPoint(date=p.date, weight_kg=_round(p.weight_kg, 2), trend_kg=round(p.trend_kg, 2)) for p in points],
        latest_trend_kg=_round(latest_trend, 2),
        rate_kg_per_week=_round(rate_kg, 2),
        rate_pct_per_week=_round(rate_pct, 2),
        intake=IntakeStats(days_logged=logged_days, avg_kcal=_round(avg_kcal), avg_protein_g=_round(avg_protein)),
        tdee_estimate_kcal=_round(tdee, 0),
        tdee_confidence=confidence,
        bmr_kcal=_round(bmr, 0),
        maintenance_from_profile=_round(bmr * factor, 0) if bmr is not None and factor else None,
        safe_floor_kcal=round(safe_floor_kcal(bmr, user.sex)),
        targets=ProgressTargets(
            target_kcal=user.target_kcal, target_protein_g=user.target_protein_g, target_weight_kg=user.target_weight_kg
        ),
        protein_per_kg=_round(user.target_protein_g / latest_trend, 2) if latest_trend else None,
    )
