import re
from urllib.parse import parse_qsl, urlparse

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.external import openfoodfacts, usda
from app.external.nutrient_checks import atwater_kcal
from app.models.food import Food
from app.models.nutrient import Nutrient
from app.services.food_service import create_food_from_external, get_food_by_barcode


def _gtin_ok(code: str) -> bool:
    digits = [int(c) for c in code]
    total = sum(d * (3 if i % 2 == 0 else 1) for i, d in enumerate(reversed(digits[:-1])))
    return (10 - total % 10) % 10 == digits[-1]


def _upc_e_to_a(code: str) -> str | None:
    """A short US UPC-E code written out as the 12 digit UPC-A it stands for."""
    if len(code) != 8 or code[0] not in "01":
        return None
    ns, d, check = code[0], code[1:7], code[7]
    last = int(d[5])
    if last <= 2:
        body = d[:2] + d[5] + "0000" + d[2:5]
    elif last == 3:
        body = d[:3] + "00000" + d[3:5]
    elif last == 4:
        body = d[:4] + "00000" + d[4]
    else:
        body = d[:5] + "0000" + d[5]
    return ns + body + check


def check_digit_ok(code: str) -> bool:
    """GTIN check digit (EAN-8, UPC-E, UPC-A, EAN-13, GTIN-14). A wrong one means the scan misread a bar."""
    if not code.isdigit() or len(code) not in (8, 12, 13, 14):
        return True  # not a retail code we can check; let the lookup decide
    if _gtin_ok(code):
        return True
    upc_a = _upc_e_to_a(code)
    return upc_a is not None and _gtin_ok(upc_a)


_GS = "\x1d"
# Element strings with a fixed length (GS1 General Specifications); the rest end at a GS.
_GS1_FIXED = {"00": 18, "01": 14, "02": 14, "11": 6, "12": 6, "13": 6, "15": 6, "16": 6, "17": 6, "20": 2}


def _gs1_ai(text: str) -> tuple[int, int | None]:
    two = text[:2]
    if two in _GS1_FIXED:
        return 2, _GS1_FIXED[two]
    if re.match(r"3[1-6]", two):
        return 4, 6
    if two == "41":
        return 3, 13
    if re.match(r"2[3-5]|4[02-9]", two):
        return 3, None
    if re.match(r"39|7\d|8\d", two):
        return 4, None
    return 2, None


def _gs1_pairs(text: str) -> list[tuple[str, str]]:
    if text.startswith("("):
        return [(ai, value.strip()) for ai, value in re.findall(r"\((\d{2,4})\)([^(]*)", text)]
    if re.match(r"https?://", text, re.I):
        url = urlparse(text)
        parts = [p for p in url.path.split("/") if p]
        pairs = [(parts[k], parts[k + 1]) for k in range(len(parts) - 1) if re.fullmatch(r"\d{2,4}", parts[k])]
        return pairs + [(k, v) for k, v in parse_qsl(url.query) if re.fullmatch(r"\d{2,4}", k)]
    if not text[:1].isdigit() or re.fullmatch(r"\d{8,14}", text):
        return []  # a plain EAN, not an element string
    pairs, i = [], 0
    while i < len(text):
        if text[i] == _GS:
            i += 1
            continue
        length, fixed = _gs1_ai(text[i:])
        ai = text[i : i + length]
        if fixed is not None:
            pairs.append((ai, text[i + length : i + length + fixed]))
            i += length + fixed
            continue
        end = text.find(_GS, i + length)
        pairs.append((ai, text[i + length : None if end == -1 else end]))
        i = len(text) if end == -1 else end + 1
    return pairs


# Coop's reduced-price sticker ("Verwenden statt Verschwenden") covers the pack's EAN with a
# Code 128: "27", the pack's EAN-13, one digit and the new price in centimes.
_MARKDOWN_LABEL = re.compile(r"27(\d{13})\d(\d{8})")


def gs1_scan(raw: str) -> tuple[str, float | None] | None:
    """(GTIN, pack grams) from a GS1 2D code's text: the DataMatrix on Coop and Migros counter
    labels carries the product's own GTIN (the same on every pack) and the net weight (AI 3103).
    Coop's reduced-price sticker gives (GTIN, None). None for anything else. Mirrors parseGs1 in
    frontend/src/lib/gs1.ts."""
    markdown = _MARKDOWN_LABEL.fullmatch(raw.strip())
    if markdown:
        return markdown.group(1), None
    text = re.sub(r"^\][A-Za-z]\d", "", raw.strip()).lstrip(_GS)
    pairs = _gs1_pairs(text)
    gtin = next((v for ai, v in pairs if ai == "01"), None)
    if gtin is None or not re.fullmatch(r"\d{14}", gtin):
        return None
    grams = None
    weight = next(((ai, v) for ai, v in pairs if re.fullmatch(r"310[0-5]", ai)), None)
    if weight and re.fullmatch(r"\d{6}", weight[1]):
        kg = int(weight[1]) / 10 ** int(weight[0][3])
        grams = round(kg * 1000, 1) if 0 < kg <= 10 else None
    return (gtin[1:] if gtin.startswith("0") else gtin), grams


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
    scan = gs1_scan(barcode)
    barcode = scan[0] if scan else "".join(barcode.split())

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


def _energy_off(food: Food) -> bool:
    """Saved calories far from what the macros add up to: a typo the import let through before
    the kcal/kJ check existed (148 kcal saved for a 222 kcal breaded chicken)."""
    n = food.nutrients
    if n is None or n.kcal is None:
        return False
    macros = atwater_kcal(n)
    return macros is not None and abs(n.kcal - macros) > max(30, 0.25 * macros)


async def _refill_blank(db: AsyncSession, food: Food) -> Food:
    """Products often reach Open Food Facts before anyone types in their label. A food saved blank,
    or with calories its own macros contradict, that nobody has corrected is looked up again, so
    the values arrive (or get fixed) once they are right outside."""
    if food.corrected_at is not None or food.barcode is None:
        return food
    if not (_is_blank(food) or _energy_off(food)):
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
