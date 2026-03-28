from sqlalchemy.ext.asyncio import AsyncSession

from app.external import openfoodfacts, usda
from app.models.food import Food
from app.schemas.food import FoodCreate, NutrientData
from app.services.food_service import create_food_from_external, get_food_by_barcode


async def lookup_barcode(db: AsyncSession, barcode: str) -> Food | None:
    """Layered barcode lookup: local DB → OpenFoodFacts → USDA. Auto-persists."""

    # 1. Local DB
    food = await get_food_by_barcode(db, barcode)
    if food is not None:
        return food

    # 2. OpenFoodFacts
    result = await openfoodfacts.lookup_barcode(barcode)
    if result is not None:
        name, nutrients = result
        return await create_food_from_external(db, name, barcode, "openfoodfacts", nutrients)

    # 3. USDA FoodData Central
    result = await usda.lookup_barcode(barcode)
    if result is not None:
        name, nutrients = result
        return await create_food_from_external(db, name, barcode, "usda", nutrients)

    return None
