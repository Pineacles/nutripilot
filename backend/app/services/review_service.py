"""The weekly review: one week of logging, intake against targets and the weight trend, as plain
numbers plus a few factual flags. It is read only and computed on demand, so an assistant can
write a check-in from facts instead of guessing them. The flag rules are pure functions at the
top so they can be unit tested; ``get_week_review`` at the bottom reads the database."""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.food_log import FoodLog
from app.models.micronutrient_target import MicronutrientTarget
from app.models.nutrient import Nutrient
from app.models.user import User
from app.models.weight_log import WeightLog
from app.schemas.review import (
    MicronutrientGap,
    ReviewDay,
    ReviewFlag,
    ReviewIntake,
    ReviewPrevious,
    ReviewTargets,
    ReviewWeight,
    WeekReview,
)
from app.services import progress_service as ps
from app.services import summary_service
from app.services.clock import today_for
from app.services.game_service import WINDOW_FLOOR_KCAL

WEEK_DAYS = 7
TREND_LOOKBACK_DAYS = 42  # the trend needs history before the week to settle
FULL_LOGGING_DAYS = 6
PROTEIN_LOW_SHARE = 0.9
FIBER_LOW_SHARE = 0.8
WEEKEND_GAP_KCAL = 300
FAST_LOSS_PCT = -1.0  # losing more than 1 % of body weight a week
MIN_WEIGH_INS_FOR_RATE = 4
MICRO_LOW_SHARE = 0.7
# A nutrient average is only judged when foods with a value for it make up this share of the kcal;
# below it the average mostly measures missing data.
MIN_COVERAGE = 0.7


def _round(value: float | None, digits: int = 1) -> float | None:
    return None if value is None else round(value, digits)


def _avg(values: list[float]) -> float | None:
    return sum(values) / len(values) if values else None


def review_flags(
    *,
    logged_days: int,
    light_days: int,
    avg_protein: float | None,
    target_protein: float | None,
    avg_fiber: float | None,
    target_fiber: float | None,
    weekday_kcal: float | None,
    weekend_kcal: float | None,
    under_floor_days: int,
    hard_floor: float,
    fiber_coverage: float,
    thin_data: list[str],
    rate_pct: float | None,
    rate_kg: float | None,
    weigh_ins: int,
    trend_kg: float | None,
    target_weight: float | None,
    micro_gaps: list[MicronutrientGap],
) -> list[ReviewFlag]:
    """Facts worth a sentence in a check-in. Each flag says what was measured, never what it means
    about the person."""
    flags: list[ReviewFlag] = []
    if logged_days < FULL_LOGGING_DAYS:
        flags.append(ReviewFlag(code="logging_gaps", detail=f"{logged_days} of {WEEK_DAYS} days have food logged"))
    if light_days:
        flags.append(ReviewFlag(
            code="light_days",
            detail=f"{light_days} logged day(s) under {WINDOW_FLOOR_KCAL} kcal, probably not fully logged",
        ))
    if under_floor_days >= 2:
        flags.append(ReviewFlag(
            code="under_safe_floor",
            detail=f"{under_floor_days} fully logged day(s) under {hard_floor:.0f} kcal; check in kindly, never push lower",
        ))
    if avg_protein is not None and target_protein and avg_protein < PROTEIN_LOW_SHARE * target_protein:
        flags.append(ReviewFlag(code="protein_low", detail=f"protein averaged {avg_protein:.0f} of {target_protein:.0f} g"))
    if avg_fiber is not None and target_fiber and fiber_coverage >= MIN_COVERAGE and avg_fiber < FIBER_LOW_SHARE * target_fiber:
        flags.append(ReviewFlag(code="fiber_low", detail=f"fiber averaged {avg_fiber:.0f} of {target_fiber:.0f} g"))
    if weekday_kcal is not None and weekend_kcal is not None and weekend_kcal - weekday_kcal > WEEKEND_GAP_KCAL:
        flags.append(ReviewFlag(
            code="weekend_higher", detail=f"weekends averaged {weekend_kcal - weekday_kcal:.0f} kcal more than weekdays"
        ))
    if rate_pct is not None and weigh_ins >= MIN_WEIGH_INS_FOR_RATE:
        if rate_pct < FAST_LOSS_PCT:
            flags.append(ReviewFlag(
                code="loss_too_fast", detail=f"trend falling {-rate_pct:.1f} % of body weight a week, faster than 1 %"
            ))
        elif rate_kg is not None and rate_kg >= 0 and trend_kg is not None and target_weight is not None and target_weight < trend_kg:
            flags.append(ReviewFlag(code="trend_not_falling", detail=f"trend changing {rate_kg:+.2f} kg a week"))
    if thin_data:
        flags.append(ReviewFlag(
            code="nutrient_data_thin",
            detail="too few logged foods have values for " + ", ".join(thin_data) + "; those averages are lower bounds, not gaps",
        ))
    for gap in micro_gaps:
        flags.append(ReviewFlag(code="micronutrient_low", detail=f"{gap.nutrient} averaged {gap.avg:g} of {gap.target:g} {gap.unit}"))
    return flags


async def _daily_intake(db: AsyncSession, user: User, start: date, end: date) -> dict[date, dict[str, float]]:
    ratio = FoodLog.quantity_g / 100.0
    rows = (
        await db.execute(
            select(
                FoodLog.date,
                func.sum(ratio * func.coalesce(Nutrient.kcal, 0)).label("kcal"),
                func.sum(ratio * func.coalesce(Nutrient.protein, 0)).label("protein"),
                func.sum(ratio * func.coalesce(Nutrient.fiber, 0)).label("fiber"),
            )
            .outerjoin(Nutrient, Nutrient.food_id == FoodLog.food_id)
            .where(FoodLog.user_id == user.id, FoodLog.date >= start, FoodLog.date <= end)
            .group_by(FoodLog.date)
        )
    ).all()
    return {r.date: {"kcal": float(r.kcal), "protein": float(r.protein), "fiber": float(r.fiber)} for r in rows}


async def _coverage(db: AsyncSession, user: User, start: date, end: date, fields: list[str]) -> dict[str, float]:
    """Per nutrient: the share of logged kcal that comes from foods with a value for it."""
    kcal = FoodLog.quantity_g * func.coalesce(Nutrient.kcal, 0)
    cols = [func.sum(kcal).label("total")] + [
        func.sum(case((getattr(Nutrient, f).is_not(None), kcal), else_=0)).label(f) for f in fields
    ]
    row = (
        await db.execute(
            select(*cols)
            .join(Nutrient, Nutrient.food_id == FoodLog.food_id)
            .where(FoodLog.user_id == user.id, FoodLog.date >= start, FoodLog.date <= end)
        )
    ).one()
    total = float(row.total or 0)
    return {f: (float(getattr(row, f) or 0) / total if total else 0.0) for f in fields}


async def get_week_review(db: AsyncSession, user: User, end_date: date | None = None) -> WeekReview:
    today = today_for(user)
    # Default: the last finished day, so the review never counts a day still being eaten.
    end = end_date or (today - timedelta(days=1))
    start = end - timedelta(days=WEEK_DAYS - 1)
    prev_start, prev_end = start - timedelta(days=WEEK_DAYS), start - timedelta(days=1)

    intake = await _daily_intake(db, user, prev_start, end)

    weights = (
        await db.execute(
            select(WeightLog.date, WeightLog.weight_kg).where(
                WeightLog.user_id == user.id,
                WeightLog.date >= end - timedelta(days=TREND_LOOKBACK_DAYS - 1),
                WeightLog.date <= end,
            )
        )
    ).all()
    daily_weight = ps.daily_weights([(r.date, r.weight_kg) for r in weights])
    points = ps.smooth_trend(daily_weight, end)
    by_day = {p.date: p for p in points}
    rate_kg, rate_pct = ps.weekly_rate(points)
    trend_end = points[-1].trend_kg if points else None
    before = by_day.get(start - timedelta(days=1)) or by_day.get(start)
    trend_start = before.trend_kg if before else None
    weigh_ins_week = sum(1 for d in daily_weight if start <= d <= end)
    weigh_ins_rate = sum(1 for d in daily_weight if end - timedelta(days=ps.RATE_SPAN_DAYS) < d <= end)

    bmr = None
    if trend_end is not None and user.height_cm and user.birth_year and user.sex:
        bmr = ps.bmr_mifflin_st_jeor(trend_end, user.height_cm, end.year - user.birth_year, user.sex)
    floor = ps.safe_floor_kcal(bmr, user.sex)
    hard_floor = ps.safe_floor_kcal(None, user.sex)

    days: list[ReviewDay] = []
    for i in range(WEEK_DAYS):
        d = start + timedelta(days=i)
        got = intake.get(d)
        kcal = got["kcal"] if got else None
        days.append(ReviewDay(
            date=d,
            weekday=d.strftime("%a"),
            logged=got is not None,
            kcal=_round(kcal, 0),
            protein_g=_round(got["protein"]) if got else None,
            fiber_g=_round(got["fiber"]) if got else None,
            weight_kg=_round(daily_weight.get(d), 2),
            in_kcal_window=bool(got) and WINDOW_FLOOR_KCAL <= kcal <= user.target_kcal,
            protein_met=bool(got) and got["protein"] >= user.target_protein_g,
            fiber_met=bool(got) and got["fiber"] >= user.target_fiber_g,
        ))

    logged = [x for x in days if x.logged]
    full = [x for x in logged if x.kcal >= WINDOW_FLOOR_KCAL]
    weekday_kcal = _avg([x.kcal for x in full if x.date.weekday() < 5])
    weekend_kcal = _avg([x.kcal for x in full if x.date.weekday() >= 5])
    avg_protein = _avg([x.protein_g for x in full])
    avg_fiber = _avg([x.fiber_g for x in full])

    prev = [intake[d] for d in intake if prev_start <= d <= prev_end]
    prev_full = [v for v in prev if v["kcal"] >= WINDOW_FLOOR_KCAL]

    week = await summary_service.get_week_summary(db, user, end)
    micro_targets = (
        await db.execute(select(MicronutrientTarget).where(MicronutrientTarget.user_id == user.id))
    ).scalars().all()
    micro_avg = week.micronutrient_avg.model_dump()
    tracked = [t for t in micro_targets if t.nutrient in micro_avg and hasattr(Nutrient, t.nutrient)]
    coverage = await _coverage(db, user, start, end, ["fiber"] + [t.nutrient for t in tracked])
    thin = [f for f, share in coverage.items() if full and share < MIN_COVERAGE]
    gaps = []
    for t in tracked:
        value = micro_avg.get(t.nutrient)
        if (full and t.target_value and value is not None and coverage[t.nutrient] >= MIN_COVERAGE
                and value < MICRO_LOW_SHARE * t.target_value):
            gaps.append(MicronutrientGap(nutrient=t.nutrient, avg=round(value, 1), target=t.target_value, unit=t.unit))

    weight = ReviewWeight(
        weigh_in_days=weigh_ins_week,
        trend_start_kg=_round(trend_start, 2),
        trend_end_kg=_round(trend_end, 2),
        trend_change_kg=_round(trend_end - trend_start, 2) if trend_start is not None and trend_end is not None else None,
        rate_kg_per_week=_round(rate_kg, 2),
        rate_pct_per_week=_round(rate_pct, 2),
        target_weight_kg=user.target_weight_kg,
        last_weigh_in=max(daily_weight) if daily_weight else None,
    )
    return WeekReview(
        start=start,
        end=end,
        days=days,
        targets=ReviewTargets(
            kcal=user.target_kcal, protein_g=user.target_protein_g, fiber_g=user.target_fiber_g,
            safe_floor_kcal=round(floor),
        ),
        intake=ReviewIntake(
            logged_days=len(logged),
            full_days=len(full),
            avg_kcal=_round(_avg([x.kcal for x in full]), 0),
            avg_protein_g=_round(avg_protein),
            avg_fiber_g=_round(avg_fiber),
            weekday_avg_kcal=_round(weekday_kcal, 0),
            weekend_avg_kcal=_round(weekend_kcal, 0),
            kcal_window_days=sum(x.in_kcal_window for x in days),
            protein_met_days=sum(x.protein_met for x in days),
            fiber_met_days=sum(x.fiber_met for x in days),
            fiber_coverage_pct=round(100 * coverage["fiber"]),
        ),
        previous_week=ReviewPrevious(
            logged_days=len(prev),
            avg_kcal=_round(_avg([v["kcal"] for v in prev_full]), 0),
            avg_protein_g=_round(_avg([v["protein"] for v in prev_full])),
        ),
        weight=weight,
        micronutrient_gaps=gaps,
        flags=review_flags(
            logged_days=len(logged),
            light_days=len(logged) - len(full),
            avg_protein=avg_protein,
            target_protein=user.target_protein_g,
            avg_fiber=avg_fiber,
            target_fiber=user.target_fiber_g,
            weekday_kcal=weekday_kcal,
            weekend_kcal=weekend_kcal,
            under_floor_days=sum(1 for x in full if x.kcal < hard_floor),
            hard_floor=hard_floor,
            fiber_coverage=coverage["fiber"],
            thin_data=thin,
            rate_pct=rate_pct,
            rate_kg=rate_kg,
            weigh_ins=weigh_ins_rate,
            trend_kg=trend_end,
            target_weight=user.target_weight_kg,
            micro_gaps=gaps,
        ),
    )
