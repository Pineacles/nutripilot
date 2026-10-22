import httpx

from app.schemas.food import NutrientData

KJ_PER_KCAL = 4.184
SALT_PER_SODIUM = 2.5

# OFF reports every mass nutrient per 100 g in grams (calcium 0.12 = 120 mg). Our columns use the
# units in the second field, so the factor converts grams to them.
_FIELDS: dict[str, tuple[str, float]] = {
    "protein": ("proteins", 1),
    "carbs": ("carbohydrates", 1),
    "sugar": ("sugars", 1),
    "fiber": ("fiber", 1),
    "fat": ("fat", 1),
    "sat_fat": ("saturated-fat", 1),
    "alcohol": ("alcohol", 1),
    "calcium": ("calcium", 1000),
    "potassium": ("potassium", 1000),
    "omega3": ("omega-3-fat", 1000),
    "zinc": ("zinc", 1000),
    "vit_d": ("vitamin-d", 1_000_000),
    "vit_c": ("vitamin-c", 1000),
    "magnesium": ("magnesium", 1000),
    "b12": ("vitamin-b12", 1_000_000),
    "iron": ("iron", 1000),
    "caffeine_mg": ("caffeine", 1000),
}


def _number(value) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number >= 0 else None


def serving_grams(product: dict) -> float | None:
    """The package serving in grams, or None when OFF has no usable number.
    For drinks OFF may give ml here; treated as grams, which is close enough for most drinks."""
    grams = _number(product.get("serving_quantity"))
    return grams if grams and grams > 0 else None


def _per_100g(n: dict, key: str, serving_g: float | None) -> float | None:
    """A nutrient per 100 g, worked out from the per serving value when only that was entered."""
    value = _number(n.get(f"{key}_100g"))
    if value is not None:
        return value
    per_serving = _number(n.get(f"{key}_serving"))
    if per_serving is not None and serving_g:
        return per_serving * 100 / serving_g
    return None


def _round(value: float | None) -> float | None:
    return None if value is None else round(value, 4)


def parse_nutrients(n: dict, serving_g: float | None) -> NutrientData:
    """OFF nutriments to our per 100 g columns, with the checks OFF's own quality rules use:
    kcal from kJ when only kJ is given, salt from sodium, per serving values scaled to 100 g,
    and grams converted to mg / µg."""
    kcal = _per_100g(n, "energy-kcal", serving_g)
    if kcal is None:
        kj = _per_100g(n, "energy-kj", serving_g)
        if kj is None:
            kj = _per_100g(n, "energy", serving_g)  # OFF's plain energy field is always kJ
        kcal = kj / KJ_PER_KCAL if kj is not None else None

    salt = _per_100g(n, "salt", serving_g)
    if salt is None:
        sodium = _per_100g(n, "sodium", serving_g)
        salt = sodium * SALT_PER_SODIUM if sodium is not None else None

    values = {}
    for column, (key, factor) in _FIELDS.items():
        grams = _per_100g(n, key, serving_g)
        values[column] = _round(grams * factor) if grams is not None else None

    return NutrientData(kcal=_round(kcal), salt=_round(salt), vit_k2=None, **values)



async def search_by_text(query: str, limit: int = 10) -> list[dict]:
    """Search OpenFoodFacts by text query. Returns list of basic food info."""
    url = "https://world.openfoodfacts.org/cgi/search.pl"
    params = {
        "search_terms": query,
        "search_simple": 1,
        "action": "process",
        "json": 1,
        "page_size": limit,
        "fields": "product_name,nutriments,code,serving_quantity,serving_size",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(url, params=params)
        except httpx.HTTPError:
            return []
        if resp.status_code != 200:
            return []
        data = resp.json()

    results = []
    for product in data.get("products", []):
        name = product.get("product_name")
        if not name:
            continue
        serving_g = serving_grams(product)
        nutrients = parse_nutrients(product.get("nutriments", {}), serving_g)
        results.append({
            "name": name,
            "barcode": product.get("code"),
            "kcal": nutrients.kcal,
            "protein": nutrients.protein,
            "source": "openfoodfacts",
            "serving_size_g": serving_g,
            "serving_label": product.get("serving_size") if serving_g else None,
        })
    return results


async def lookup_barcode(barcode: str) -> tuple[str, NutrientData, float | None, str | None] | None:
    """Look up a barcode on OpenFoodFacts. Returns (product_name, nutrients, serving g, serving label) or None."""
    url = f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        if resp.status_code != 200:
            return None
        data = resp.json()

    if data.get("status") != 1:
        return None

    product = data.get("product", {})
    name = product.get("product_name") or product.get("product_name_en") or "Unknown"
    serving_size_g = serving_grams(product)
    nutrients = parse_nutrients(product.get("nutriments", {}), serving_size_g)
    serving_label = product.get("serving_size") if serving_size_g else None  # text like "1 slice (30g)"
    return name, nutrients, serving_size_g, serving_label
