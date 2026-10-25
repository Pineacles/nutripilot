from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.external import openfoodfacts, usda
from app.models.food import Food
from app.models.nutrient import Nutrient
from app.services.food_service import create_food_from_external, get_food_by_barcode


def check_digit_ok(code: str) -> bool:
    """GTIN check digit (EAN-8, UPC-A, EAN-13, GTIN-14). A wrong one means the scan misread a bar."""
    if not code.isdigit() or len(code) not in (8, 12, 13, 14):
        return True  # not a retail code we can check; let the lookup decide
    digits = [int(c) for c in code]
    total = sum(d * (3 if i % 2 == 0 else 1) for i, d in enumerate(reversed(digits[:-1])))
    return (10 - total % 10) % 10 == digits[-1]


def is_store_label(code: str) -> bool:
    """In-store codes (EAN-13 starting with 2): the weighed or price labels Migros, Coop and others
    print at the counter. They carry the shop's own item number and the weight or price, so they are
    in no product database and differ from pack to pack."""
    return code.isdigit() and len(code) == 13 and code[0] == "2"


def barcode_problem(code: str) -> str | None:
    """Why looking a code up outside is pointless: "store_label", "misread", or None."""
    if is_store_label(code):
        return "store_label"
    if not check_digit_ok(code):
        return "misread"
    return None


async def lookup_barcode(db: AsyncSession, barcode: str) -> Food | None:
    """Layered barcode lookup: local DB → OpenFoodFacts → USDA. Auto-persists."""
    barcode = "".join(barcode.split())

    # 1. Local DB (also finds foods someone saved under a code the checks below would skip)
    food = await get_food_by_barcode(db, barcode)
    if food is not None:
        return await _refill_blank(db, food)
    if barcode_problem(barcode):
        return None

    # 2. OpenFoodFacts (covers Swiss shops), 3. USDA FoodData Central (US products only)
    for source, lookup in (("openfoodfacts", openfoodfacts.lookup_barcode), ("usda", usda.lookup_barcode)):
        result = await lookup(barcode)
        if result is None:
            continue
        name, nutrients, serving_size_g, serving_label = result
        try:
            return await create_food_from_external(
                db, name, barcode, source, nutrients,
                serving_size_g=serving_size_g, serving_label=serving_label,
            )
        except IntegrityError:
            # Scanned twice at once: the other request saved it first.
            await db.rollback()
            return await get_food_by_barcode(db, barcode)

    return None


def _is_blank(food: Food) -> bool:
    return food.nutrients is None or food.nutrients.kcal is None


async def _refill_blank(db: AsyncSession, food: Food) -> Food:
    """Products often reach Open Food Facts before anyone types in their label. A food saved blank
    that nobody has filled in yet is looked up again, so the values arrive once someone adds them."""
    if not _is_blank(food) or food.corrected_at is not None or food.barcode is None:
        return food
    lookup = {"openfoodfacts": openfoodfacts.lookup_barcode, "usda": usda.lookup_barcode}.get(food.source)
    if lookup is None:
        return food
    result = await lookup(food.barcode)
    if result is None or result[1].kcal is None:
        return food
    _, nutrients, serving_size_g, serving_label = result
    if food.nutrients is None:
        food.nutrients = Nutrient(food_id=food.id)
    for field, value in nutrients.model_dump().items():
        setattr(food.nutrients, field, value)
    if food.serving_size_g is None and serving_size_g:
        food.serving_size_g = serving_size_g
        food.serving_label = serving_label[:100] if serving_label else None
    await db.commit()
    await db.refresh(food)
    return food
