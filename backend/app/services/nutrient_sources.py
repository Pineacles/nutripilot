"""Shared nutrient-sources service used by both the dashboard and agent routers."""

from __future__ import annotations

from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.food import Food
from app.models.food_log import FoodLog
from app.models.supplement import Supplement
from app.models.supplement_definition import SupplementDefinition
from app.models.user import User

# Allowlist of valid nutrient field names derived from the Nutrient model.
# Any nutrient not in this set will receive a 400 response (prevents attribute-fishing).
ALLOWED_NUTRIENTS: frozenset[str] = frozenset({
    # macros
    "kcal", "protein", "carbs", "sugar", "fiber", "fat", "sat_fat",
    "alcohol", "caffeine_mg",
    # micros
    "calcium", "potassium", "omega3", "zinc", "vit_d", "vit_k2",
    "vit_c", "magnesium", "b12", "iron",
    # special alias (derived from salt * 400 in the query)
    "sodium",
})

SUPP_MICRO_MAP: dict[str, str] = {
    "vit_d": "vitamin_d",
    "zinc": "zinc",
    "omega3": "omega3",
    "iron": "iron",
    "calcium": "calcium",
    "magnesium": "magnesium",
    "b12": "b12",
    "vit_c": "vit_c",
    "potassium": "potassium",
}


async def get_nutrient_sources(
    db: AsyncSession,
    user: User,
    nutrient: str,
    from_date: date,
    to_date: date,
) -> dict:
    """Return foods/supplements that contributed to *nutrient* between *from_date* and *to_date*.

    Raises HTTP 400 if *nutrient* is not in ALLOWED_NUTRIENTS.
    """
    if nutrient not in ALLOWED_NUTRIENTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_NUTRIENT",
                "nutrient": nutrient,
                "allowed": sorted(ALLOWED_NUTRIENTS),
            },
        )

    stmt = (
        select(FoodLog)
        .where(FoodLog.user_id == user.id, FoodLog.date >= from_date, FoodLog.date <= to_date)
        .options(joinedload(FoodLog.food).joinedload(Food.nutrients))
    )
    result = await db.execute(stmt)
    logs = result.unique().scalars().all()

    is_sodium = nutrient == "sodium"

    sources: list[dict] = []
    for log in logs:
        n = log.food.nutrients
        if not n:
            continue
        ratio = log.quantity_g / 100.0

        if is_sodium:
            raw_val = (n.salt or 0) * 400
        else:
            raw_val = getattr(n, nutrient, None)
            if raw_val is None:
                continue

        amount = round(raw_val * ratio, 2)
        if amount <= 0:
            continue

        sources.append({
            "food_name": log.food.name,
            "quantity_g": log.quantity_g,
            "amount": amount,
            "date": str(log.date),
            "meal_type": log.meal_type,
        })

    sources.sort(key=lambda x: x["amount"], reverse=True)

    # Supplement contributions for micronutrients
    supp_key = SUPP_MICRO_MAP.get(nutrient)
    supp_key_aliases = {nutrient, supp_key} if supp_key else {nutrient}
    reverse_map = {v: k for k, v in SUPP_MICRO_MAP.items()}
    if nutrient in reverse_map:
        supp_key_aliases.add(reverse_map[nutrient])
    supp_key_aliases.discard(None)

    supp_sources: list[dict] = []
    if supp_key_aliases:
        defs_result = await db.execute(
            select(SupplementDefinition).where(SupplementDefinition.user_id == user.id)
        )
        defs = {d.name.lower(): d for d in defs_result.scalars().all()}

        supp_result = await db.execute(
            select(Supplement).where(
                Supplement.user_id == user.id,
                Supplement.date >= from_date,
                Supplement.date <= to_date,
            )
        )
        for s in supp_result.scalars().all():
            defn = defs.get(s.name.lower())
            if not defn or not defn.micronutrients:
                continue
            for alias in supp_key_aliases:
                if alias in defn.micronutrients:
                    val = defn.micronutrients[alias]
                    if isinstance(val, (int, float)) and val > 0:
                        supp_sources.append({
                            "food_name": f"{s.name} (supplement)",
                            "quantity_g": s.dose_amount,
                            "amount": round(val, 2),
                            "date": str(s.date),
                            "meal_type": "supplement",
                        })
                    break

    all_sources = sources + supp_sources
    all_sources.sort(key=lambda x: x["amount"], reverse=True)
    total = round(sum(s["amount"] for s in all_sources), 2)

    return {
        "nutrient": nutrient,
        "from_date": str(from_date),
        "to_date": str(to_date),
        "total": total,
        "sources": all_sources[:30],
    }
