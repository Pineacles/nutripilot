import httpx

from app.schemas.food import NutrientData


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
        n = product.get("nutriments", {})
        results.append({
            "name": name,
            "barcode": product.get("code"),
            "kcal": n.get("energy-kcal_100g"),
            "protein": n.get("proteins_100g"),
            "source": "openfoodfacts",
            "serving_size_g": product.get("serving_quantity"),
            "serving_label": product.get("serving_size"),
        })
    return results


async def lookup_barcode(barcode: str) -> tuple[str, NutrientData, float | None, str | None] | None:
    """Look up a barcode on OpenFoodFacts. Returns (product_name, nutrients) or None."""
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
    n = product.get("nutriments", {})

    nutrients = NutrientData(
        kcal=n.get("energy-kcal_100g"),
        protein=n.get("proteins_100g"),
        carbs=n.get("carbohydrates_100g"),
        sugar=n.get("sugars_100g"),
        fiber=n.get("fiber_100g"),
        fat=n.get("fat_100g"),
        sat_fat=n.get("saturated-fat_100g"),
        salt=n.get("salt_100g"),
        calcium=n.get("calcium_100g"),
        potassium=n.get("potassium_100g"),
        omega3=n.get("omega-3-fat_100g"),
        zinc=n.get("zinc_100g"),
        vit_d=n.get("vitamin-d_100g"),
        vit_k2=None,  # not available in OFF
        vit_c=n.get("vitamin-c_100g"),
        magnesium=n.get("magnesium_100g"),
        b12=n.get("vitamin-b12_100g"),
        iron=n.get("iron_100g"),
        caffeine_mg=n.get("caffeine_100g"),
    )
    serving_size_g = product.get("serving_quantity")  # numeric grams
    serving_label = product.get("serving_size")  # text like "1 slice (30g)"
    return name, nutrients, serving_size_g, serving_label
