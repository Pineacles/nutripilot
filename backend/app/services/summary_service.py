from collections import defaultdict
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import func as sa_func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.food import Food
from app.models.food_log import FoodLog
from app.models.nutrient import Nutrient
from app.models.supplement import Supplement
from app.models.user import User
from app.models.weight_log import WeightLog
from app.schemas.summary import (
    BodyCompEntry,
    MacroTargets,
    MacroTotals,
    MealGroup,
    MealItem,
    MicronutrientAverages,
    StatsSummary,
    SupplementEntry,
    TodaySummary,
    WeekSummary,
    WeightDelta,
)


def _aggregate_macros(food_logs):
    """Aggregate all macro fields from food logs."""
    totals = {"kcal": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0, "fiber": 0.0, "sugar": 0.0, "sodium": 0.0}
    for log in food_logs:
        ratio = log.quantity_g / 100.0
        n = log.food.nutrients
        if not n:
            continue
        totals["kcal"] += (n.kcal or 0) * ratio
        totals["protein"] += (n.protein or 0) * ratio
        totals["carbs"] += (n.carbs or 0) * ratio
        totals["fat"] += (n.fat or 0) * ratio
        totals["fiber"] += (n.fiber or 0) * ratio
        totals["sugar"] += (n.sugar or 0) * ratio
        # salt field is in grams, convert to mg for sodium (salt * 400 = sodium approx)
        totals["sodium"] += ((n.salt or 0) * 400) * ratio
    return totals


async def get_today_summary(db: AsyncSession, user: User, target_date: date | None = None) -> TodaySummary:
    target_date = target_date or date.today()

    stmt = (
        select(FoodLog)
        .where(FoodLog.user_id == user.id, FoodLog.date == target_date)
        .options(joinedload(FoodLog.food).joinedload(Food.nutrients))
    )
    result = await db.execute(stmt)
    food_logs = result.unique().scalars().all()

    totals = _aggregate_macros(food_logs)

    meals_map: dict[str, list[MealItem]] = defaultdict(list)
    for log in food_logs:
        ratio = log.quantity_g / 100.0
        n = log.food.nutrients
        kcal = (n.kcal or 0) * ratio if n else 0
        meals_map[log.meal_type].append(
            MealItem(food_name=log.food.name, quantity_g=log.quantity_g, kcal=round(kcal, 1))
        )
    meals = [MealGroup(meal_type=mt, items=items) for mt, items in meals_map.items()]

    stmt = select(Supplement).where(Supplement.user_id == user.id, Supplement.date == target_date)
    result = await db.execute(stmt)
    supps = result.scalars().all()
    supplement_entries = [
        SupplementEntry(name=s.name, dose_amount=s.dose_amount, dose_unit=s.dose_unit, time_of_day=s.time_of_day)
        for s in supps
    ]

    return TodaySummary(
        date=target_date,
        totals=MacroTotals(**{k: round(v, 1) for k, v in totals.items()}),
        targets=MacroTargets(
            kcal=user.target_kcal,
            protein=user.target_protein_g,
            carbs=user.target_carbs_g,
            fat=user.target_fat_g,
            fiber=user.target_fiber_g,
            sugar=user.target_sugar_g,
            sodium=user.target_sodium_mg,
        ),
        meals=meals,
        supplements=supplement_entries,
    )


async def get_week_summary(db: AsyncSession, user: User, end_date: date | None = None) -> WeekSummary:
    end_date = end_date or date.today()
    start_date = end_date - timedelta(days=6)

    stmt = (
        select(FoodLog)
        .where(FoodLog.user_id == user.id, FoodLog.date >= start_date, FoodLog.date <= end_date)
        .options(joinedload(FoodLog.food).joinedload(Food.nutrients))
    )
    result = await db.execute(stmt)
    food_logs = result.unique().scalars().all()

    days_with_data: set[date] = set()
    macro_totals = {"kcal": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0, "fiber": 0.0, "sugar": 0.0, "sodium": 0.0}
    micro_fields = ["calcium", "potassium", "omega3", "zinc", "vit_d", "vit_k2", "vit_c", "magnesium", "b12", "iron"]
    micro_totals: dict[str, float] = {f: 0.0 for f in micro_fields}

    for log in food_logs:
        days_with_data.add(log.date)
        ratio = log.quantity_g / 100.0
        n = log.food.nutrients
        if not n:
            continue
        macro_totals["kcal"] += (n.kcal or 0) * ratio
        macro_totals["protein"] += (n.protein or 0) * ratio
        macro_totals["carbs"] += (n.carbs or 0) * ratio
        macro_totals["fat"] += (n.fat or 0) * ratio
        macro_totals["fiber"] += (n.fiber or 0) * ratio
        macro_totals["sugar"] += (n.sugar or 0) * ratio
        macro_totals["sodium"] += ((n.salt or 0) * 400) * ratio

        for field in micro_fields:
            val = getattr(n, field, None)
            if val is not None:
                micro_totals[field] += val * ratio

    num_days = max(len(days_with_data), 1)

    # Weight + body composition
    stmt = (
        select(WeightLog)
        .where(WeightLog.user_id == user.id, WeightLog.date >= start_date, WeightLog.date <= end_date)
        .order_by(WeightLog.date.asc())
    )
    result = await db.execute(stmt)
    weight_logs = result.scalars().all()

    start_kg = weight_logs[0].weight_kg if weight_logs else None
    end_kg = weight_logs[-1].weight_kg if weight_logs else None
    delta = round(end_kg - start_kg, 2) if start_kg is not None and end_kg is not None else None

    body_comp = [
        BodyCompEntry(
            date=w.date, weight_kg=w.weight_kg,
            body_fat_pct=w.body_fat_pct, muscle_mass_pct=w.muscle_mass_pct,
        )
        for w in weight_logs
    ]

    return WeekSummary(
        start_date=start_date,
        end_date=end_date,
        daily_avg=MacroTotals(**{k: round(v / num_days, 1) for k, v in macro_totals.items()}),
        micronutrient_avg=MicronutrientAverages(
            **{f: round(micro_totals[f] / num_days, 2) if micro_totals[f] > 0 else None for f in micro_fields}
        ),
        weight=WeightDelta(start_kg=start_kg, end_kg=end_kg, delta=delta),
        body_comp=body_comp,
    )


async def get_stats_summary(db: AsyncSession, user: User, days: int = 90) -> StatsSummary:
    end = date.today()
    start = end - timedelta(days=days - 1)

    # Weight history
    stmt = (
        select(WeightLog)
        .where(WeightLog.user_id == user.id, WeightLog.date >= start)
        .order_by(WeightLog.date.asc())
    )
    result = await db.execute(stmt)
    weight_logs = result.scalars().all()
    weight_history = [
        BodyCompEntry(date=w.date, weight_kg=w.weight_kg, body_fat_pct=w.body_fat_pct, muscle_mass_pct=w.muscle_mass_pct)
        for w in weight_logs
    ]

    # Daily calorie data
    stmt = (
        select(FoodLog)
        .where(FoodLog.user_id == user.id, FoodLog.date >= start)
        .options(joinedload(FoodLog.food).joinedload(Food.nutrients))
    )
    result = await db.execute(stmt)
    food_logs = result.unique().scalars().all()

    daily_data: dict[date, dict] = defaultdict(lambda: {"kcal": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0, "fiber": 0.0, "sugar": 0.0, "sodium": 0.0})
    for log in food_logs:
        ratio = log.quantity_g / 100.0
        n = log.food.nutrients
        if not n:
            continue
        d = daily_data[log.date]
        d["kcal"] += (n.kcal or 0) * ratio
        d["protein"] += (n.protein or 0) * ratio
        d["carbs"] += (n.carbs or 0) * ratio
        d["fat"] += (n.fat or 0) * ratio
        d["fiber"] += (n.fiber or 0) * ratio
        d["sugar"] += (n.sugar or 0) * ratio
        d["sodium"] += ((n.salt or 0) * 400) * ratio

    daily_calories = [
        {"date": str(d), "kcal": round(v["kcal"], 1)}
        for d, v in sorted(daily_data.items())
    ]

    # Macro averages
    num_days_logged = max(len(daily_data), 1)
    macro_sums = {"kcal": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0, "fiber": 0.0, "sugar": 0.0, "sodium": 0.0}
    for d in daily_data.values():
        for k in macro_sums:
            macro_sums[k] += d[k]
    macro_avg = MacroTotals(**{k: round(v / num_days_logged, 1) for k, v in macro_sums.items()})

    # Records
    highest_protein = None
    lowest_calorie = None
    for d, v in daily_data.items():
        if highest_protein is None or v["protein"] > highest_protein["protein"]:
            highest_protein = {"date": str(d), "protein": round(v["protein"], 1)}
        if lowest_calorie is None or (v["kcal"] > 0 and v["kcal"] < lowest_calorie["kcal"]):
            lowest_calorie = {"date": str(d), "kcal": round(v["kcal"], 1)}

    # Streak: consecutive days with food logs ending today
    streak = 0
    check_date = end
    while check_date in daily_data:
        streak += 1
        check_date -= timedelta(days=1)

    # Supplement adherence
    stmt = select(Supplement.date).where(
        Supplement.user_id == user.id, Supplement.date >= start
    ).distinct()
    result = await db.execute(stmt)
    supp_days = len(result.all())
    adherence = round((supp_days / days) * 100, 1)

    return StatsSummary(
        weight_history=weight_history,
        daily_calories=daily_calories,
        macro_avg=macro_avg,
        days_logged=len(daily_data),
        total_days=days,
        supplement_adherence_pct=adherence,
        highest_protein_day=highest_protein,
        lowest_calorie_day=lowest_calorie,
        current_streak=streak,
    )
