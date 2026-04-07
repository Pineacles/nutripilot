import httpx

from app.config import settings
from app.schemas.food import NutrientData

# USDA nutrient ID mapping (FoodData Central)
_NUTRIENT_MAP = {
    1008: "kcal",
    1003: "protein",
    1005: "carbs",
    2000: "sugar",
    1079: "fiber",
    1004: "fat",
    1258: "sat_fat",
    1093: "salt",  # sodium in mg, will convert
    1087: "calcium",
    1092: "potassium",
    1404: "omega3",  # total polyunsaturated
    1095: "zinc",
    1114: "vit_d",
    1185: "vit_k2",  # vitamin K (menaquinone-4)
    1162: "vit_c",
    1090: "magnesium",
    1178: "b12",
    1089: "iron",
    1057: "caffeine_mg",
}


async def lookup_barcode(barcode: str) -> tuple[str, NutrientData, float | None, str | None] | None:
    """Look up a barcode on USDA FoodData Central. Returns (name, nutrients) or None."""
    if not settings.usda_api_key:
        return None

    url = "https://api.nal.usda.gov/fdc/v1/foods/search"
    params = {"query": barcode, "api_key": settings.usda_api_key, "pageSize": 1}

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params=params)
        if resp.status_code != 200:
            return None
        data = resp.json()

    foods = data.get("foods", [])
    if not foods:
        return None

    food = foods[0]
    name = food.get("description", "Unknown")

    nutrient_values: dict[str, float | None] = {}
    for n in food.get("foodNutrients", []):
        nid = n.get("nutrientId")
        if nid in _NUTRIENT_MAP:
            field = _NUTRIENT_MAP[nid]
            value = n.get("value")
            # Convert sodium mg to salt g (salt ≈ sodium × 2.5 / 1000)
            if nid == 1093 and value is not None:
                value = value * 2.5 / 1000
            nutrient_values[field] = value

    nutrients = NutrientData(**nutrient_values)

    # Extract serving size if available
    serving_size_g = food.get("servingSize")
    serving_label = food.get("householdServingFullText")

    return name, nutrients, serving_size_g, serving_label
