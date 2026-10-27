import re

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


# "2 pces", "4 Stück", "3 pezzi" in a name or quantity: a pack of equal pieces.
_PIECES = re.compile(r"(\d{1,2})\s*(?:pces?|pcs|pi[eè]ces?|st[uü]ck|stk|pezzi|portionen|portions?)\b", re.I)
# "2 x 150 g": the piece weight is written out.
_TIMES_GRAMS = re.compile(r"(\d{1,2})\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*g\b", re.I)


def piece_serving(product: dict) -> tuple[float, str] | None:
    """(grams, label) for one piece of a multi-piece pack when OFF has no serving: Bell's
    "Poulet delice 2pces" at 300 g is 150 g a piece. None when the pack doesn't say."""
    text = " ".join(str(product.get(f) or "") for f in (*_NAME_FIELDS, "quantity"))
    if m := _TIMES_GRAMS.search(text):
        grams = float(m.group(2).replace(",", "."))
        return (grams, f"1 piece ({grams:g} g)") if 0 < grams <= 2000 else None
    m = _PIECES.search(text)
    total = _number(product.get("product_quantity"))
    unit = str(product.get("product_quantity_unit") or "g").lower()
    if not m or not total or unit != "g":
        return None
    count = int(m.group(1))
    if not 2 <= count <= 24:
        return None
    grams = round(total / count, 1)
    return grams, f"1 piece ({grams:g} g)"


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


# OFF rarely has a caffeine value, even for products that plainly contain it. When it gives none, a
# conservative per 100 g / 100 ml figure by category is used instead (first matching entry wins, so the
# specific categories come before the general ones). An explicit value from OFF, even 0, always wins.
_CAFFEINE_BY_CATEGORY: tuple[tuple[tuple[str, ...], float], ...] = (
    (("en:energy-drinks", "en:energy-drinks-with-sugar", "en:sweetened-energy-drinks", "en:artificially-sweetened-energy-drinks"), 32),
    (("en:instant-coffees", "en:instant-coffee-powders"), 3000),
    (("en:colas", "en:cola-sodas", "en:sweetened-colas", "en:artificially-sweetened-colas"), 10),
    (("en:iced-teas", "en:ice-teas", "en:tea-based-beverages", "en:sweetened-iced-teas"), 12),
    (("en:iced-coffees", "en:coffee-drinks", "en:coffee-beverages", "en:coffee-based-beverages"), 25),
    (("en:coffees", "en:ground-coffees", "en:roasted-coffees"), 40),
    (("en:teas", "en:black-teas", "en:green-teas", "en:herbal-teas-with-caffeine", "en:mate-teas"), 20),
)
# Herbal teas and infusions sit under en:teas in OFF's tree but contain no caffeine.
_DECAF_TAGS = {
    "en:decaffeinated-coffees", "en:decaffeinated-teas", "en:decaffeinated-products",
    "en:herbal-teas", "en:infusions", "en:fruit-teas", "en:rooibos-teas", "en:caffeine-free",
}
_DECAF_WORDS = ("decaf", "entkoffeiniert", "koffeinfrei", "d\u00e9caf\u00e9in\u00e9", "decaffeinato")
_CAFFEINE_WORDS = ("caffeine", "koffein", "caf\u00e9ine", "caffeina")


def estimate_caffeine_mg(product: dict) -> float | None:
    """A conservative caffeine estimate per 100 g / 100 ml for a clearly caffeinated product, else None."""
    tags = {t for t in product.get("categories_tags") or [] if isinstance(t, str)}
    text = " ".join(str(product.get(f) or "") for f in (*_NAME_FIELDS, "ingredients_text")).lower()
    if tags & _DECAF_TAGS or any(word in text for word in _DECAF_WORDS):
        return None
    for categories, mg in _CAFFEINE_BY_CATEGORY:
        if tags.intersection(categories):
            return mg
    if any(word in text for word in _CAFFEINE_WORDS) and "en:beverages" in tags:
        return 32  # a drink that lists caffeine as an ingredient is an energy drink in practice
    return None


def parse_product_nutrients(product: dict, serving_g: float | None) -> NutrientData:
    """parse_nutrients, plus the caffeine estimate when OFF has no caffeine value for the product."""
    nutrients = parse_nutrients(product.get("nutriments", {}), serving_g)
    if nutrients.caffeine_mg is None:
        nutrients.caffeine_mg = estimate_caffeine_mg(product)
    return nutrients



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
    nutrients = parse_product_nutrients(product, serving_size_g)
    serving_label = product.get("serving_size") if serving_size_g else None  # text like "1 slice (30g)"
    if serving_size_g is None and (piece := piece_serving(product)):
        serving_size_g, serving_label = piece
    return name, nutrients, serving_size_g, serving_label
