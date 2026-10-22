import httpx

from app.config import settings
from app.external.nutrient_checks import clean_imported
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
    1404: "omega3",  # ALA (18:3 n-3), in grams; stored as mg
    1095: "zinc",
    1114: "vit_d",
    1185: "vit_k2",  # vitamin K (menaquinone-4)
    1162: "vit_c",
    1090: "magnesium",
    1178: "b12",
    1089: "iron",
    1057: "caffeine_mg",
}


def _same_barcode(a: str | None, b: str) -> bool:
    """UPC-A and EAN-13 write the same code with or without leading zeros."""
    return bool(a) and a.strip().lstrip("0") == b.strip().lstrip("0")


async def lookup_barcode(barcode: str) -> tuple[str, NutrientData, float | None, str | None] | None:
    """Look up a barcode on USDA FoodData Central. Returns (name, nutrients, serving g, serving label) or None.

    The search is full text, so its first hit can be a different product that merely mentions the
    number; only a branded food whose GTIN/UPC is this barcode counts.
    """
    if not settings.usda_api_key:
        return None

    url = "https://api.nal.usda.gov/fdc/v1/foods/search"
    params = {"query": barcode, "api_key": settings.usda_api_key, "pageSize": 5, "dataType": "Branded"}

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params=params)
        if resp.status_code != 200:
            return None
        data = resp.json()

    food = next((f for f in data.get("foods", []) if _same_barcode(f.get("gtinUpc"), barcode)), None)
    if food is None:
        return None
    name = food.get("description", "Unknown")

    nutrient_values: dict[str, float | None] = {}
    kj = None
    for n in food.get("foodNutrients", []):
        nid = n.get("nutrientId")
        value = n.get("value")
        if not isinstance(value, (int, float)) or value < 0:
            continue
        if nid == 1062:
            kj = value
        if nid in _NUTRIENT_MAP:
            field = _NUTRIENT_MAP[nid]
            # Convert sodium mg to salt g (salt ≈ sodium × 2.5 / 1000)
            if nid == 1093:
                value = value * 2.5 / 1000
            elif nid == 1404:
                value = value * 1000
            nutrient_values[field] = value

    nutrients = clean_imported(NutrientData(**nutrient_values), kj=kj)

    # Branded serving sizes are in g or ml (ml treated as g, like Open Food Facts drinks); others are skipped.
    serving_size_g = food.get("servingSize")
    unit = (food.get("servingSizeUnit") or "").lower()
    if not isinstance(serving_size_g, (int, float)) or serving_size_g <= 0 or unit not in ("g", "grm", "ml", "mlt"):
        serving_size_g = None
    serving_label = food.get("householdServingFullText") if serving_size_g else None

    return name, nutrients, serving_size_g, serving_label
