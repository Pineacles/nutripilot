"""OFF nutriments are normalised the way OFF's own data quality rules expect."""

from app.external.openfoodfacts import lookup_barcode, parse_nutrients, parse_product_nutrients, serving_grams


def test_plain_per_100g_values_pass_through():
    n = parse_nutrients({"energy-kcal_100g": 539, "proteins_100g": 6.3, "fat_100g": 30.9, "salt_100g": 0.107}, None)
    assert (n.kcal, n.protein, n.fat, n.salt) == (539, 6.3, 30.9, 0.107)


def test_kcal_from_kj_when_kcal_is_missing():
    assert parse_nutrients({"energy-kj_100g": 418.4}, None).kcal == 100
    assert parse_nutrients({"energy_100g": 2092, "energy_unit": "kJ"}, None).kcal == 500


def test_salt_from_sodium():
    assert parse_nutrients({"sodium_100g": 0.4}, None).salt == 1.0
    # A real salt value wins over sodium.
    assert parse_nutrients({"salt_100g": 0.9, "sodium_100g": 0.4}, None).salt == 0.9


def test_per_serving_values_scaled_to_100g():
    n = parse_nutrients({"energy-kcal_serving": 150, "proteins_serving": 6}, 30)
    assert n.kcal == 500 and n.protein == 20
    # Without a serving weight there is nothing to scale by.
    assert parse_nutrients({"energy-kcal_serving": 150}, None).kcal is None


def test_minerals_and_vitamins_converted_from_grams():
    n = parse_nutrients({"calcium_100g": 0.12, "vitamin-d_100g": 0.0000025, "iron_100g": 0.0021, "caffeine_100g": 0.032}, None)
    assert n.calcium == 120
    assert n.vit_d == 2.5
    assert n.iron == 2.1
    assert n.caffeine_mg == 32


def test_bad_numbers_are_ignored():
    n = parse_nutrients({"energy-kcal_100g": "", "proteins_100g": "abc", "fat_100g": -3}, None)
    assert n.kcal is None and n.protein is None and n.fat is None


def test_serving_grams():
    assert serving_grams({"serving_quantity": "30"}) == 30
    assert serving_grams({"serving_quantity": 0}) is None
    assert serving_grams({"serving_quantity": None}) is None
    assert serving_grams({}) is None


def _product(**fields):
    return {"nutriments": {"energy-kcal_100g": 45}, **fields}


def test_caffeine_filled_for_energy_drink_without_value():
    p = _product(categories_tags=["en:beverages", "en:energy-drinks"])
    assert parse_product_nutrients(p, None).caffeine_mg == 32


def test_caffeine_by_category():
    assert parse_product_nutrients(_product(categories_tags=["en:colas"]), None).caffeine_mg == 10
    assert parse_product_nutrients(_product(categories_tags=["en:iced-teas", "en:teas"]), None).caffeine_mg == 12
    assert parse_product_nutrients(_product(categories_tags=["en:iced-coffees"]), None).caffeine_mg == 25
    assert parse_product_nutrients(_product(categories_tags=["en:coffees"]), None).caffeine_mg == 40


def test_off_caffeine_value_wins_over_estimate_even_zero():
    p = _product(categories_tags=["en:energy-drinks"])
    p["nutriments"]["caffeine_100g"] = 0.03
    assert parse_product_nutrients(p, None).caffeine_mg == 30
    p["nutriments"]["caffeine_100g"] = 0
    assert parse_product_nutrients(p, None).caffeine_mg == 0


def test_caffeine_from_ingredients_only_for_drinks():
    drink = _product(categories_tags=["en:beverages"], ingredients_text="Water, sugar, Koffein, Taurin")
    assert parse_product_nutrients(drink, None).caffeine_mg == 32
    food = _product(categories_tags=["en:snacks"], ingredients_text="Sugar, caffeine")
    assert parse_product_nutrients(food, None).caffeine_mg is None


def test_no_caffeine_estimate_for_decaf_herbal_or_unrelated():
    assert parse_product_nutrients(_product(categories_tags=["en:coffees", "en:decaffeinated-coffees"]), None).caffeine_mg is None
    assert parse_product_nutrients(_product(product_name="Decaf Espresso", categories_tags=["en:coffees"]), None).caffeine_mg is None
    assert parse_product_nutrients(_product(categories_tags=["en:teas", "en:herbal-teas"]), None).caffeine_mg is None
    assert parse_product_nutrients(_product(categories_tags=["en:sodas"]), None).caffeine_mg is None
    assert parse_product_nutrients(_product(), None).caffeine_mg is None


def test_estimate_reaches_barcode_lookup(monkeypatch):
    import asyncio

    class Resp:
        status_code = 200

        def json(self):
            return {"status": 1, "product": {"product_name": "Power Can", "nutriments": {"energy-kcal_100g": 45},
                                             "categories_tags": ["en:energy-drinks"]}}

    class Client:
        def __init__(self, *a, **k): ...
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def get(self, *a, **k): return Resp()

    monkeypatch.setattr("app.external.openfoodfacts.httpx.AsyncClient", Client)
    _, nutrients, _, _ = asyncio.run(lookup_barcode("1234567890123"))
    assert nutrients.caffeine_mg == 32
