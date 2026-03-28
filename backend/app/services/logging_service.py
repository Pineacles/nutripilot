from datetime import date
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.food_log import FoodLog
from app.models.supplement import Supplement
from app.models.weight_log import WeightLog


async def log_food(
    db: AsyncSession,
    user_id: UUID,
    food_id: UUID,
    quantity_g: float,
    meal_type: str,
    log_date: date | None = None,
) -> FoodLog:
    entry = FoodLog(
        user_id=user_id,
        food_id=food_id,
        quantity_g=quantity_g,
        meal_type=meal_type,
        date=log_date or date.today(),
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


async def log_supplement(
    db: AsyncSession,
    user_id: UUID,
    name: str,
    dose_amount: float,
    dose_unit: str,
    time_of_day: str | None = None,
    log_date: date | None = None,
) -> Supplement:
    entry = Supplement(
        user_id=user_id,
        name=name,
        dose_amount=dose_amount,
        dose_unit=dose_unit,
        time_of_day=time_of_day,
        date=log_date or date.today(),
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


async def log_weight(
    db: AsyncSession,
    user_id: UUID,
    weight_kg: float,
    body_fat_pct: float | None = None,
    muscle_mass_pct: float | None = None,
    source: str = "manual",
    log_date: date | None = None,
) -> WeightLog:
    entry = WeightLog(
        user_id=user_id,
        weight_kg=weight_kg,
        muscle_mass_pct=muscle_mass_pct,
        body_fat_pct=body_fat_pct,
        source=source,
        date=log_date or date.today(),
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry
