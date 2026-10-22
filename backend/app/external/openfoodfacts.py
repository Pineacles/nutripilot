import httpx

from app.external.nutrient_checks import KJ_PER_KCAL, clean_imported
from app.schemas.food import NutrientData

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
    grams converted to mg / µg, and impossible values dropped (see nutrient_checks)."""
    kj = _per_100g(n, "energy-kj", serving_g)
    if kj is None:
        kj = _per_100g(n, "energy", serving_g)  # OFF's plain energy field is always kJ
    kcal = _per_100g(n, "energy-kcal", serving_g)
    if kcal is None and kj is not None:
        kcal = kj / KJ_PER_KCAL

    salt = _per_100g(n, "salt", serving_g)
    if salt is None:
        sodium = _per_100g(n, "sodium", serving_g)
        salt = sodium * SALT_PER_SODIUM if sodium is not None else None

    values = {}
    for column, (key, factor) in _FIELDS.items():
        grams = _per_100g(n, key, serving_g)
        values[column] = _round(grams * factor) if grams is not None else None

    return clean_imported(NutrientData(kcal=_round(kcal), salt=_round(salt), vit_k2=None, **values), kj=kj)



# OFF asks every app to name itself. No contact details: they would identify the owner.
HEADERS = {"User-Agent": "NutriPilot/1.0 (self-hosted nutrition tracker)"}
# Swiss shops: the label name is German, French or Italian, so those come before English.
_NAME_FIELDS = ("product_name", "product_name_de", "product_name_fr", "product_name_it", "product_name_en", "generic_name")
_SEARCH_FIELDS = ",".join((*_NAME_FIELDS, "brands", "nutriments", "code", "serving_quantity", "serving_size"))


def product_name(product: dict) -> str | None:
    """The label name with the first brand, "Vollmilch (Migros)", the way foods are named here."""
    name = next((product[f].strip() for f in _NAME_FIELDS if isinstance(product.get(f), str) and product[f].strip()), None)
    if not name:
        return None
    brand = (product.get("brands") or "").split(",")[0].strip()
    if brand and brand.lower() not in name.lower():
        name = f"{name} ({brand})"
    return name


async def _search(query: str, limit: int, country: str | None) -> list[dict]:
    params = {
        "search_terms": query,
        "search_simple": 1,
        "action": "process",
        "json": 1,
        "page_size": limit,
        "fields": _SEARCH_FIELDS,
    }
    if country:
        params |= {"tagtype_0": "countries", "tag_contains_0": "contains", "tag_0": country}
    async with httpx.AsyncClient(timeout=10, headers=HEADERS) as client:
        try:
            resp = await client.get("https://world.openfoodfacts.org/cgi/search.pl", params=params)
            if resp.status_code != 200:
                return []
            return resp.json().get("products", [])
        except (httpx.HTTPError, ValueError):
            return []


async def search_by_text(query: str, limit: int = 10) -> list[dict]:
    """Search OpenFoodFacts by text: products sold in Switzerland first, the rest of the world only when
    those are few (OFF allows about 10 searches a minute, so one call when it is enough)."""
    swiss = await _search(query, limit, "switzerland")
    world = await _search(query, limit, None) if len(swiss) < max(3, limit // 2) else []

    results = []
    seen: set[str] = set()
    for product in [*swiss, *world]:
        name = product_name(product)
        code = product.get("code")
        if not name or (code and code in seen):
            continue
        if code:
            seen.add(code)
        serving_g = serving_grams(product)
        nutrients = parse_nutrients(product.get("nutriments", {}), serving_g)
        results.append({
            "name": name,
            "barcode": code,
            "kcal": nutrients.kcal,
            "protein": nutrients.protein,
            "source": "openfoodfacts",
            "serving_size_g": serving_g,
            "serving_label": product.get("serving_size") if serving_g else None,
        })
    return results[:limit]


async def lookup_barcode(barcode: str) -> tuple[str, NutrientData, float | None, str | None] | None:
    """Look up a barcode on OpenFoodFacts. Returns (product_name, nutrients, serving g, serving label) or None."""
    url = f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
    async with httpx.AsyncClient(timeout=10, headers=HEADERS) as client:
        try:
            resp = await client.get(url)
            if resp.status_code != 200:
                return None
            data = resp.json()
        except (httpx.HTTPError, ValueError):
            return None

    if data.get("status") != 1:
        return None

    product = data.get("product", {})
    name = product_name(product) or "Unknown"
    serving_size_g = serving_grams(product)
    nutrients = parse_nutrients(product.get("nutriments", {}), serving_size_g)
    serving_label = product.get("serving_size") if serving_size_g else None  # text like "1 slice (30g)"
    return name, nutrients, serving_size_g, serving_label
