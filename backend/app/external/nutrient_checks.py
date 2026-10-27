"""Plausibility checks for nutrients imported from outside databases (Open Food Facts, USDA).

Crowd sourced labels contain typos: kJ typed into the kcal field, a per pack value in a per 100 g
field, a stray extra digit. A wrong number is worse than a missing one, because it silently ends up
in every day the food is logged, so impossible values are dropped and calories are filled in from
the macros when the label has none.
"""

from app.schemas.food import NutrientData

KJ_PER_KCAL = 4.184
# Pure fat is 900 kcal per 100 g; a little room for rounding on oil labels.
MAX_KCAL = 920
# kcal and kJ on one label agree within rounding; more than this apart means one of them is a typo.
ENERGY_DISAGREE = 0.08
# Mass nutrients counted in grams per 100 g.
GRAM_FIELDS = ("protein", "carbs", "sugar", "fiber", "fat", "sat_fat", "salt", "alcohol")


def atwater_kcal(n: NutrientData) -> float | None:
    """Calories from the macros (4 protein, 4 carbs, 9 fat, 7 alcohol), when all three main ones are known."""
    if n.protein is None or n.carbs is None or n.fat is None:
        return None
    return 4 * n.protein + 4 * n.carbs + 9 * n.fat + 7 * (n.alcohol or 0)


def clean_imported(n: NutrientData, kj: float | None = None) -> NutrientData:
    """Drop impossible per 100 g values and fill in missing calories. kj is the label's kJ, if any."""
    values = n.model_dump()
    for field in GRAM_FIELDS:
        if values[field] is not None and values[field] > 100:
            values[field] = None
    # Parts can't be more than the whole.
    if values["sugar"] is not None and values["carbs"] is not None and values["sugar"] > values["carbs"] + 0.5:
        values["sugar"] = None
    if values["sat_fat"] is not None and values["fat"] is not None and values["sat_fat"] > values["fat"] + 0.5:
        values["sat_fat"] = None

    kcal = values["kcal"]
    # kJ typed into the kcal field: the "kcal" equals the kJ number, or is impossibly high.
    if kcal is not None and kj is not None and kj > 0 and abs(kcal - kj) < 1 and kj > 20:
        kcal = kj / KJ_PER_KCAL
    if kcal is not None and kcal > MAX_KCAL:
        kcal = kj / KJ_PER_KCAL if kj is not None and kj / KJ_PER_KCAL <= MAX_KCAL else None
    cleaned = NutrientData(**{**values, "kcal": kcal})
    # kcal and kJ that disagree (928 kJ saved with 148 kcal): the macros say which one is the typo.
    if kcal is not None and kj is not None and kj > 0:
        from_kj = kj / KJ_PER_KCAL
        if abs(kcal - from_kj) > max(5, ENERGY_DISAGREE * from_kj) and from_kj <= MAX_KCAL:
            macros = atwater_kcal(cleaned)
            if macros is not None and abs(from_kj - macros) < abs(kcal - macros):
                cleaned.kcal = from_kj
    if cleaned.kcal is None:
        estimate = atwater_kcal(cleaned)
        if estimate is not None and estimate <= MAX_KCAL:
            cleaned.kcal = estimate
    if cleaned.kcal is not None:
        cleaned.kcal = round(cleaned.kcal, 4)
    return cleaned
