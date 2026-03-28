from collections import defaultdict
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.food import Food
from app.models.food_log import FoodLog
from app.models.nutrient import Nutrient
from app.models.supplement import Supplement
from app.models.user import User
from app.models.weight_log import WeightLog
from app.schemas.summary import (
    MacroTotals,
    MealGroup,
    MealItem,
    MicronutrientAverages,
    SupplementEntry,
    TodaySummary,
    WeekSummary,
    WeightDelta,
)


async def get_today_summary(db: AsyncSession, user: User, target_date: date | None = None) -> TodaySummary:
    target_date = target_date or date.today()

    # Food logs with joined food + nutrients
    stmt = (
        select(FoodLog)
        .where(FoodLog.user_id == user.id, FoodLog.date == target_date)
        .options(joinedload(FoodLog.food).joinedload(Food.nutrients))
    )
    result = await db.execute(stmt)
    food_logs = result.unique().scalars().all()

    # Aggregate macros and group by meal
    total_kcal = 0.0
    total_protein = 0.0
    total_carbs = 0.0
    total_fat = 0.0
    meals_map: dict[str, list[MealItem]] = defaultdict(list)

    for log in food_logs:
        ratio = log.quantity_g / 100.0
        n = log.food.nutrients
        kcal = (n.kcal or 0) * ratio if n else 0
        protein = (n.protein or 0) * ratio if n else 0
        carbs = (n.carbs or 0) * ratio if n else 0
        fat = (n.fat or 0) * ratio if n else 0

        total_kcal += kcal
        total_protein += protein
        total_carbs += carbs
        total_fat += fat

        meals_map[log.meal_type].append(
            MealItem(food_name=log.food.name, quantity_g=log.quantity_g, kcal=round(kcal, 1))
        )

    meals = [MealGroup(meal_type=mt, items=items) for mt, items in meals_map.items()]

    # Supplements
    stmt = select(Supplement).where(Supplement.user_id == user.id, Supplement.date == target_date)
    result = await db.execute(stmt)
    supps = result.scalars().all()
    supplement_entries = [
        SupplementEntry(name=s.name, dose_amount=s.dose_amount, dose_unit=s.dose_unit, time_of_day=s.time_of_day)
        for s in supps
    ]

    return TodaySummary(
        date=target_date,
        totals=MacroTotals(
            kcal=round(total_kcal, 1),
            protein=round(total_protein, 1),
            carbs=round(total_carbs, 1),
            fat=round(total_fat, 1),
        ),
        targets=MacroTotals(
            kcal=user.target_kcal,
            protein=user.target_protein_g,
            carbs=user.target_carbs_g,
            fat=user.target_fat_g,
        ),
        meals=meals,
        supplements=supplement_entries,
    )


async def get_week_summary(db: AsyncSession, user: User, end_date: date | None = None) -> WeekSummary:
    end_date = end_date or date.today()
    start_date = end_date - timedelta(days=6)

    # Food logs for the week
    stmt = (
        select(FoodLog)
        .where(FoodLog.user_id == user.id, FoodLog.date >= start_date, FoodLog.date <= end_date)
        .options(joinedload(FoodLog.food).joinedload(Food.nutrients))
    )
    result = await db.execute(stmt)
    food_logs = result.unique().scalars().all()

    # Per-day macro totals + micro accumulation
    days_with_data: set[date] = set()
    total_kcal = 0.0
    total_protein = 0.0
    total_carbs = 0.0
    total_fat = 0.0

    micro_fields = ["calcium", "potassium", "omega3", "zinc", "vit_d", "vit_k2", "vit_c", "magnesium", "b12", "iron"]
    micro_totals: dict[str, float] = {f: 0.0 for f in micro_fields}

    for log in food_logs:
        days_with_data.add(log.date)
        ratio = log.quantity_g / 100.0
        n = log.food.nutrients
        if not n:
            continue

        total_kcal += (n.kcal or 0) * ratio
        total_protein += (n.protein or 0) * ratio
        total_carbs += (n.carbs or 0) * ratio
        total_fat += (n.fat or 0) * ratio

        for field in micro_fields:
            val = getattr(n, field, None)
            if val is not None:
                micro_totals[field] += val * ratio

    num_days = max(len(days_with_data), 1)

    # Weight data
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

    return WeekSummary(
        start_date=start_date,
        end_date=end_date,
        daily_avg=MacroTotals(
            kcal=round(total_kcal / num_days, 1),
            protein=round(total_protein / num_days, 1),
            carbs=round(total_carbs / num_days, 1),
            fat=round(total_fat / num_days, 1),
        ),
        micronutrient_avg=MicronutrientAverages(
            **{f: round(micro_totals[f] / num_days, 2) if micro_totals[f] > 0 else None for f in micro_fields}
        ),
        weight=WeightDelta(start_kg=start_kg, end_kg=end_kg, delta=delta),
    )
