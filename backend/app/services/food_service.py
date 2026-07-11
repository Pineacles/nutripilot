from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.food import Food
from app.models.nutrient import Nutrient
from app.schemas.food import FoodCreate, NutrientData


async def create_food(
    db: AsyncSession, data: FoodCreate, source: str = "manual", created_by: UUID | None = None
) -> Food:
    food = Food(name=data.name, barcode=data.barcode, source=source,
                serving_size_g=data.serving_size_g, serving_label=data.serving_label,
                created_by=created_by)
    db.add(food)
    await db.flush()

    nutrient = Nutrient(food_id=food.id, **data.nutrients.model_dump())
    db.add(nutrient)
    await db.commit()
    await db.refresh(food)
    return food


# Nutrient columns copied when cloning a food (everything except the food_id PK).
_NUTRIENT_FIELDS = [
    "kcal", "protein", "carbs", "sugar", "fiber", "fat", "sat_fat", "salt",
    "calcium", "potassium", "omega3", "zinc", "vit_d", "vit_k2", "vit_c",
    "magnesium", "b12", "iron", "alcohol", "caffeine_mg",
]


async def clone_food(db: AsyncSession, source_food: Food, owner_id: UUID, name: str | None = None) -> Food:
    """Copy a food (and its nutrient row) into a new user-owned manual food.

    The clone drops the barcode (unique) and is owned by ``owner_id`` so the
    user can edit it freely without touching the shared/official original.
    """
    clone = Food(
        name=name or f"{source_food.name} (custom)",
        barcode=None,
        source="manual",
        serving_size_g=source_food.serving_size_g,
        serving_label=source_food.serving_label,
        created_by=owner_id,
    )
    db.add(clone)
    await db.flush()

    src_n = source_food.nutrients
    nutrient_values = {f: getattr(src_n, f, None) for f in _NUTRIENT_FIELDS} if src_n else {}
    db.add(Nutrient(food_id=clone.id, **nutrient_values))
    await db.commit()
    await db.refresh(clone)
    return clone


async def create_food_from_external(
    db: AsyncSession, name: str, barcode: str | None, source: str, nutrients: NutrientData,
    serving_size_g: float | None = None, serving_label: str | None = None,
) -> Food:
    food = Food(name=name, barcode=barcode, source=source,
                serving_size_g=serving_size_g, serving_label=serving_label)
    db.add(food)
    await db.flush()

    nutrient = Nutrient(food_id=food.id, **nutrients.model_dump())
    db.add(nutrient)
    await db.commit()
    await db.refresh(food)
    return food


async def search_foods(db: AsyncSession, query: str, limit: int = 10) -> list[dict]:
    # Use pg_trgm similarity on PostgreSQL; fall back to LIKE on other dialects (e.g. SQLite in tests)
    dialect_name = db.bind.dialect.name if hasattr(db, "bind") and db.bind else ""
    try:
        raw = await db.get_bind()
        dialect_name = raw.dialect.name
    except Exception:
        pass

    if dialect_name == "sqlite":
        stmt = (
            select(
                Food.id,
                Food.name,
                Food.barcode,
                Nutrient.kcal,
                Nutrient.protein,
                Food.serving_size_g,
                Food.serving_label,
            )
            .outerjoin(Nutrient, Food.id == Nutrient.food_id)
            .where(Food.name.ilike(f"%{query}%"))
            .order_by(Food.name.asc())
            .limit(limit)
        )
    else:
        stmt = (
            select(
                Food.id,
                Food.name,
                Food.barcode,
                Nutrient.kcal,
                Nutrient.protein,
                Food.serving_size_g,
                Food.serving_label,
            )
            .outerjoin(Nutrient, Food.id == Nutrient.food_id)
            .where(func.similarity(Food.name, query) > 0.1)
            .order_by(func.similarity(Food.name, query).desc())
            .limit(limit)
        )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        {"id": r.id, "name": r.name, "barcode": r.barcode, "kcal": r.kcal, "protein": r.protein,
         "serving_size_g": r.serving_size_g, "serving_label": r.serving_label}
        for r in rows
    ]


async def search_foods_with_fallback(db: AsyncSession, query: str, limit: int = 10) -> list[dict]:
    """Search local DB first, then fall back to OpenFoodFacts if few results."""
    local_results = await search_foods(db, query, limit)

    if len(local_results) >= 3 or len(query) < 2:
        return local_results

    # Fetch from OpenFoodFacts to supplement results
    from app.external.openfoodfacts import search_by_text

    off_results = await search_by_text(query, limit=limit - len(local_results))

    # Deduplicate: skip OFF results whose name already appears in local results
    local_names = {r["name"].lower() for r in local_results}
    for item in off_results:
        if item["name"].lower() not in local_names:
            # OFF results don't have an id in our DB, set id to None
            local_results.append({
                "id": None,
                "name": item["name"],
                "barcode": item.get("barcode"),
                "kcal": item.get("kcal"),
                "protein": item.get("protein"),
                "source": "openfoodfacts",
                "serving_size_g": item.get("serving_size_g"),
                "serving_label": item.get("serving_label"),
            })

    return local_results[:limit]


async def get_food_by_barcode(db: AsyncSession, barcode: str) -> Food | None:
    result = await db.execute(select(Food).where(Food.barcode == barcode))
    return result.scalar_one_or_none()


async def get_food_by_id(db: AsyncSession, food_id: UUID) -> Food | None:
    result = await db.execute(select(Food).where(Food.id == food_id))
    return result.scalar_one_or_none()
