"""OFF nutriments are normalised the way OFF's own data quality rules expect."""

from app.external.openfoodfacts import parse_nutrients, serving_grams


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
