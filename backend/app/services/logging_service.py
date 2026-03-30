from datetime import date
from uuid import UUID

from sqlalchemy import select
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


def _normalize_body_comp(
    weight_kg: float,
    body_fat_pct: float | None,
    muscle_mass_pct: float | None,
    body_fat_kg: float | None,
    muscle_mass_kg: float | None,
) -> tuple[float | None, float | None, float | None, float | None]:
    """Auto-detect swapped pct/kg values and calculate missing counterparts.

    Some devices/integrations report muscle mass in kg but map it to _pct (or vice versa).
    We detect this by checking if the value makes physical sense and swap if needed.
    Then we calculate whichever of pct/kg is missing from the other.
    """
    # Detect swapped fat values
    # Fat % is typically 5-50%. Fat kg is typically 3-50kg.
    # If "pct" > 50 and no kg provided, it's likely kg not pct.
    # If "kg" > 50% of weight, it's likely pct not kg.
    if body_fat_pct is not None and body_fat_kg is None:
        if body_fat_pct > 50:
            body_fat_kg, body_fat_pct = body_fat_pct, None
    if body_fat_kg is not None and body_fat_pct is None:
        if body_fat_kg > weight_kg * 0.5:
            body_fat_pct, body_fat_kg = body_fat_kg, None

    # Detect swapped muscle values
    # Muscle % is typically 25-70%. Muscle kg is typically 20-50kg.
    # If "pct" > 70 and no kg, likely kg. If "kg" > 50% of weight, likely pct.
    if muscle_mass_pct is not None and muscle_mass_kg is None:
        if muscle_mass_pct > 70:
            muscle_mass_kg, muscle_mass_pct = muscle_mass_pct, None
    if muscle_mass_kg is not None and muscle_mass_pct is None:
        if muscle_mass_kg > weight_kg * 0.5:
            muscle_mass_pct, muscle_mass_kg = muscle_mass_kg, None

    # Calculate missing values
    if body_fat_pct is not None and body_fat_kg is None:
        body_fat_kg = round(weight_kg * body_fat_pct / 100, 2)
    elif body_fat_kg is not None and body_fat_pct is None:
        body_fat_pct = round(body_fat_kg / weight_kg * 100, 1)

    if muscle_mass_pct is not None and muscle_mass_kg is None:
        muscle_mass_kg = round(weight_kg * muscle_mass_pct / 100, 2)
    elif muscle_mass_kg is not None and muscle_mass_pct is None:
        muscle_mass_pct = round(muscle_mass_kg / weight_kg * 100, 1)

    return body_fat_pct, muscle_mass_pct, body_fat_kg, muscle_mass_kg


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
    body_fat_pct, muscle_mass_pct, body_fat_kg, muscle_mass_kg = _normalize_body_comp(
        weight_kg, body_fat_pct, muscle_mass_pct, body_fat_kg, muscle_mass_kg
    )

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


async def upsert_weight(
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
    """Insert or update a weight log entry. Deduplicates on (user_id, date, source).

    If an entry already exists for this user + date + source, update it.
    Otherwise create a new one. This makes integration syncs idempotent.

    Auto-detects if pct/kg values are swapped (e.g., a device reports muscle
    mass in kg but the integration mapped it to _pct) by checking if the value
    makes physical sense relative to the weight.
    """
    target_date = log_date or date.today()

    # Check for existing entry with same user + date + source
    result = await db.execute(
        select(WeightLog).where(
            WeightLog.user_id == user_id,
            WeightLog.date == target_date,
            WeightLog.source == source,
        )
    )
    existing = result.scalar_one_or_none()

    # Normalize: auto-detect swapped pct/kg + calculate missing values
    body_fat_pct, muscle_mass_pct, body_fat_kg, muscle_mass_kg = _normalize_body_comp(
        weight_kg, body_fat_pct, muscle_mass_pct, body_fat_kg, muscle_mass_kg
    )

    if existing:
        existing.weight_kg = weight_kg
        existing.body_fat_pct = body_fat_pct
        existing.muscle_mass_pct = muscle_mass_pct
        existing.body_fat_kg = body_fat_kg
        existing.muscle_mass_kg = muscle_mass_kg
        await db.commit()
        await db.refresh(existing)
        return existing

    entry = WeightLog(
        user_id=user_id,
        weight_kg=weight_kg,
        body_fat_pct=body_fat_pct,
        muscle_mass_pct=muscle_mass_pct,
        body_fat_kg=body_fat_kg,
        muscle_mass_kg=muscle_mass_kg,
        source=source,
        date=target_date,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry
