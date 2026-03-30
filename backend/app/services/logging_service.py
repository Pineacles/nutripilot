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
    body_fat_kg: float | None = None,
    muscle_mass_kg: float | None = None,
    source: str = "manual",
    log_date: date | None = None,
) -> WeightLog:
    # Auto-calculate missing values
    if body_fat_pct is not None and body_fat_kg is None:
        body_fat_kg = round(weight_kg * body_fat_pct / 100, 2)
    elif body_fat_kg is not None and body_fat_pct is None:
        body_fat_pct = round(body_fat_kg / weight_kg * 100, 1)

    if muscle_mass_pct is not None and muscle_mass_kg is None:
        muscle_mass_kg = round(weight_kg * muscle_mass_pct / 100, 2)
    elif muscle_mass_kg is not None and muscle_mass_pct is None:
        muscle_mass_pct = round(muscle_mass_kg / weight_kg * 100, 1)

    entry = WeightLog(
        user_id=user_id,
        weight_kg=weight_kg,
        body_fat_pct=body_fat_pct,
        muscle_mass_pct=muscle_mass_pct,
        body_fat_kg=body_fat_kg,
        muscle_mass_kg=muscle_mass_kg,
        source=source,
        date=log_date or date.today(),
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry
