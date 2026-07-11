from collections import defaultdict
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import func as sa_func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.food import Food
from app.models.food_log import FoodLog
from app.models.nutrient import Nutrient
from app.models.supplement import Supplement
from app.models.supplement_definition import SupplementDefinition
from app.models.user import User
from app.models.water_log import WaterLog
from app.models.weight_log import WeightLog
from app.services.clock import today_for
from app.schemas.summary import (
    BodyCompEntry,
    CaffeineTotals,
    DailyCaffeine,
    DailyMicros,
    DailyNutrition,
    DailyWater,
    MacroTargets,
    MacroTotals,
    MealGroup,
    MealItem,
    MicronutrientAverages,
    StatsSummary,
    SupplementEntry,
    SupplementLogEntry,
    TodaySummary,
    WaterTotals,
    WeekSummary,
    WeightDelta,
)


# Map from supplement definition keys to MicronutrientAverages field names
SUPP_MICRO_KEY_MAP = {
    "vitamin_d": "vit_d",
    "zinc": "zinc",
    "omega3": "omega3",
    "iron": "iron",
    "calcium": "calcium",
    "magnesium": "magnesium",
    "b12": "b12",
    "vit_c": "vit_c",
    "potassium": "potassium",
}


async def _get_supplement_micros(db, user_id, supp_logs, micro_fields, supp_defs=None):
    """Calculate micronutrient contributions from supplement logs.

    Matches supplement log entries to their definitions by name,
    then sums the micronutrient values from matched definitions.
    If supp_defs is provided, reuse it instead of querying the database.
    """
    if not supp_logs:
        return {f: 0.0 for f in micro_fields}

    if supp_defs is None:
        result = await db.execute(
            select(SupplementDefinition).where(SupplementDefinition.user_id == user_id)
        )
        supp_defs = {d.name.lower(): d for d in result.scalars().all()}

    supp_micros = {f: 0.0 for f in micro_fields}
    for log in supp_logs:
        defn = supp_defs.get(log.name.lower())
        if not defn or not defn.micronutrients:
            continue
        for supp_key, value in defn.micronutrients.items():
            mapped_key = SUPP_MICRO_KEY_MAP.get(supp_key, supp_key)
            if mapped_key in supp_micros and isinstance(value, (int, float)):
                supp_micros[mapped_key] += value

    return supp_micros


def _aggregate_weight_per_day(weight_logs) -> list[BodyCompEntry]:
    """Merge multiple weight log entries per day into one per day.

    Strategy:
    - weight_kg: average of all entries that day
    - body_fat_pct / muscle_mass_pct: average of non-null values, or None
    - body_fat_kg / muscle_mass_kg: average of non-null values, or None
    - If only pct or kg is available, derive the other from averaged weight
    """
    from collections import OrderedDict
    by_date: OrderedDict[date, list] = OrderedDict()
    for w in weight_logs:
        by_date.setdefault(w.date, []).append(w)

    result = []
    for d, entries in by_date.items():
        avg_weight = round(sum(e.weight_kg for e in entries) / len(entries), 1)

        bf_pct_vals = [e.body_fat_pct for e in entries if e.body_fat_pct is not None]
        avg_bf_pct = round(sum(bf_pct_vals) / len(bf_pct_vals), 1) if bf_pct_vals else None

        mm_pct_vals = [e.muscle_mass_pct for e in entries if e.muscle_mass_pct is not None]
        avg_mm_pct = round(sum(mm_pct_vals) / len(mm_pct_vals), 1) if mm_pct_vals else None

        bf_kg_vals = [e.body_fat_kg for e in entries if getattr(e, 'body_fat_kg', None) is not None]
        avg_bf_kg = round(sum(bf_kg_vals) / len(bf_kg_vals), 2) if bf_kg_vals else None

        mm_kg_vals = [e.muscle_mass_kg for e in entries if getattr(e, 'muscle_mass_kg', None) is not None]
        avg_mm_kg = round(sum(mm_kg_vals) / len(mm_kg_vals), 2) if mm_kg_vals else None

        # Calculate missing derived values
        if avg_bf_pct is not None and avg_bf_kg is None:
            avg_bf_kg = round(avg_weight * avg_bf_pct / 100, 2)
        elif avg_bf_kg is not None and avg_bf_pct is None:
            avg_bf_pct = round(avg_bf_kg / avg_weight * 100, 1)

        if avg_mm_pct is not None and avg_mm_kg is None:
            avg_mm_kg = round(avg_weight * avg_mm_pct / 100, 2)
        elif avg_mm_kg is not None and avg_mm_pct is None:
            avg_mm_pct = round(avg_mm_kg / avg_weight * 100, 1)

        result.append(BodyCompEntry(
            date=d,
            weight_kg=avg_weight,
            body_fat_pct=avg_bf_pct,
            muscle_mass_pct=avg_mm_pct,
            body_fat_kg=avg_bf_kg,
            muscle_mass_kg=avg_mm_kg,
        ))
    return result


def _aggregate_macros(food_logs):
    """Aggregate all macro fields from food logs."""
    totals = {"kcal": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0, "fiber": 0.0, "sugar": 0.0, "sodium": 0.0, "alcohol": 0.0, "caffeine_mg": 0.0}
    for log in food_logs:
        ratio = log.quantity_g / 100.0
        n = log.food.nutrients
        if not n:
            continue
        totals["kcal"] += (n.kcal or 0) * ratio
        totals["protein"] += (n.protein or 0) * ratio
        totals["carbs"] += (n.carbs or 0) * ratio
        totals["fat"] += (n.fat or 0) * ratio
        totals["fiber"] += (n.fiber or 0) * ratio
        totals["sugar"] += (n.sugar or 0) * ratio
        # salt field is in grams, convert to mg for sodium (salt * 400 = sodium approx)
        totals["sodium"] += ((n.salt or 0) * 400) * ratio
        totals["alcohol"] += (getattr(n, "alcohol", None) or 0) * ratio
        totals["caffeine_mg"] += (getattr(n, "caffeine_mg", None) or 0) * ratio
    return totals


async def get_today_summary(db: AsyncSession, user: User, target_date: date | None = None) -> TodaySummary:
    target_date = target_date or today_for(user)

    stmt = (
        select(FoodLog)
        .where(FoodLog.user_id == user.id, FoodLog.date == target_date)
        .options(joinedload(FoodLog.food).joinedload(Food.nutrients))
    )
    result = await db.execute(stmt)
    food_logs = result.unique().scalars().all()

    totals = _aggregate_macros(food_logs)

    meals_map: dict[str, list[MealItem]] = defaultdict(list)
    for log in food_logs:
        ratio = log.quantity_g / 100.0
        n = log.food.nutrients
        meals_map[log.meal_type].append(
            MealItem(
                food_name=log.food.name,
                quantity_g=log.quantity_g,
                kcal=round((n.kcal or 0) * ratio, 1) if n else None,
                protein=round((n.protein or 0) * ratio, 1) if n else None,
                carbs=round((n.carbs or 0) * ratio, 1) if n else None,
                fat=round((n.fat or 0) * ratio, 1) if n else None,
                fiber=round((n.fiber or 0) * ratio, 1) if n else None,
                sugar=round((n.sugar or 0) * ratio, 1) if n else None,
                sodium=round(((n.salt or 0) * 400) * ratio, 1) if n else None,
                alcohol=round((getattr(n, "alcohol", None) or 0) * ratio, 1) if n else None,
                caffeine_mg=round((getattr(n, "caffeine_mg", None) or 0) * ratio, 1) if n else None,
            )
        )
    meals = [MealGroup(meal_type=mt, items=items) for mt, items in meals_map.items()]

    stmt = select(Supplement).where(Supplement.user_id == user.id, Supplement.date == target_date)
    result = await db.execute(stmt)
    supps = result.scalars().all()
    supplement_entries = [
        SupplementEntry(name=s.name, dose_amount=s.dose_amount, dose_unit=s.dose_unit, time_of_day=s.time_of_day)
        for s in supps
    ]

    # Compute micronutrients from food
    micro_fields = ["calcium", "potassium", "omega3", "zinc", "vit_d", "vit_k2", "vit_c", "magnesium", "b12", "iron"]
    food_micros = {f: 0.0 for f in micro_fields}
    for log in food_logs:
        ratio = log.quantity_g / 100.0
        n = log.food.nutrients
        if not n:
            continue
        for field in micro_fields:
            val = getattr(n, field, None)
            if val is not None:
                food_micros[field] += val * ratio

    # Add supplement micronutrient contributions
    supp_micros = await _get_supplement_micros(db, user.id, supps, micro_fields)
    total_micros = {f: food_micros[f] + supp_micros[f] for f in micro_fields}

    # Water
    stmt = select(WaterLog).where(WaterLog.user_id == user.id, WaterLog.date == target_date)
    result = await db.execute(stmt)
    water_logs = result.scalars().all()
    water_total = sum(w.amount_ml for w in water_logs)

    # Caffeine (aggregated from food nutrients)
    caffeine_total = totals.pop("caffeine_mg")

    return TodaySummary(
        date=target_date,
        totals=MacroTotals(**{k: round(v, 1) for k, v in totals.items()}),
        targets=MacroTargets(
            kcal=user.target_kcal,
            protein=user.target_protein_g,
            carbs=user.target_carbs_g,
            fat=user.target_fat_g,
            fiber=user.target_fiber_g,
            sugar=user.target_sugar_g,
            sodium=user.target_sodium_mg,
            alcohol=user.target_alcohol_g,
        ),
        meals=meals,
        supplements=supplement_entries,
        water=WaterTotals(total_ml=round(water_total, 1), target_ml=user.target_water_ml),
        caffeine=CaffeineTotals(total_mg=round(caffeine_total, 1), target_mg=user.target_caffeine_mg),
        micronutrients=MicronutrientAverages(
            **{f: round(total_micros[f], 2) if total_micros[f] > 0 else None for f in micro_fields}
        ),
    )


async def get_week_summary(db: AsyncSession, user: User, end_date: date | None = None, start_override: date | None = None) -> WeekSummary:
    end_date = end_date or today_for(user)
    start_date = start_override or (end_date - timedelta(days=6))

    stmt = (
        select(FoodLog)
        .where(FoodLog.user_id == user.id, FoodLog.date >= start_date, FoodLog.date <= end_date)
        .options(joinedload(FoodLog.food).joinedload(Food.nutrients))
    )
    result = await db.execute(stmt)
    food_logs = result.unique().scalars().all()

    days_with_data: set[date] = set()
    macro_totals = {"kcal": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0, "fiber": 0.0, "sugar": 0.0, "sodium": 0.0, "alcohol": 0.0}
    micro_fields = ["calcium", "potassium", "omega3", "zinc", "vit_d", "vit_k2", "vit_c", "magnesium", "b12", "iron"]
    micro_totals: dict[str, float] = {f: 0.0 for f in micro_fields}
    daily_kcal: dict[date, float] = defaultdict(float)
    daily_caffeine: dict[date, float] = defaultdict(float)

    for log in food_logs:
        days_with_data.add(log.date)
        ratio = log.quantity_g / 100.0
        n = log.food.nutrients
        if not n:
            continue
        kcal = (n.kcal or 0) * ratio
        macro_totals["kcal"] += kcal
        macro_totals["protein"] += (n.protein or 0) * ratio
        macro_totals["carbs"] += (n.carbs or 0) * ratio
        macro_totals["fat"] += (n.fat or 0) * ratio
        macro_totals["fiber"] += (n.fiber or 0) * ratio
        macro_totals["sugar"] += (n.sugar or 0) * ratio
        macro_totals["sodium"] += ((n.salt or 0) * 400) * ratio
        macro_totals["alcohol"] += (getattr(n, "alcohol", None) or 0) * ratio
        daily_kcal[log.date] += kcal
        daily_caffeine[log.date] += (getattr(n, "caffeine_mg", None) or 0) * ratio

        for field in micro_fields:
            val = getattr(n, field, None)
            if val is not None:
                micro_totals[field] += val * ratio

    # Add supplement micronutrient contributions for the week
    result = await db.execute(
        select(SupplementDefinition).where(SupplementDefinition.user_id == user.id)
    )
    supp_defs = {d.name.lower(): d for d in result.scalars().all()}

    stmt = select(Supplement).where(
        Supplement.user_id == user.id,
        Supplement.date >= start_date,
        Supplement.date <= end_date,
    )
    result = await db.execute(stmt)
    all_supp_logs = result.scalars().all()

    for log in all_supp_logs:
        defn = supp_defs.get(log.name.lower())
        if not defn or not defn.micronutrients:
            continue
        for supp_key, value in defn.micronutrients.items():
            mapped_key = SUPP_MICRO_KEY_MAP.get(supp_key, supp_key)
            if mapped_key in micro_totals and isinstance(value, (int, float)):
                micro_totals[mapped_key] += value

    num_days = max(len(days_with_data), 1)

    # Weight + body composition
    stmt = (
        select(WeightLog)
        .where(WeightLog.user_id == user.id, WeightLog.date >= start_date, WeightLog.date <= end_date)
        .order_by(WeightLog.date.asc())
    )
    result = await db.execute(stmt)
    weight_logs = result.scalars().all()

    body_comp = _aggregate_weight_per_day(weight_logs)

    start_kg = body_comp[0].weight_kg if body_comp else None
    end_kg = body_comp[-1].weight_kg if body_comp else None
    delta = round(end_kg - start_kg, 2) if start_kg is not None and end_kg is not None else None

    from app.schemas.summary import DailyCalories
    daily_cal_list = [
        DailyCalories(date=d, kcal=round(k, 1))
        for d, k in sorted(daily_kcal.items())
    ]

    # Water logs for the week
    daily_water: dict[date, float] = defaultdict(float)
    stmt = select(WaterLog).where(WaterLog.user_id == user.id, WaterLog.date >= start_date, WaterLog.date <= end_date)
    result = await db.execute(stmt)
    for w in result.scalars().all():
        daily_water[w.date] += w.amount_ml

    return WeekSummary(
        start_date=start_date,
        end_date=end_date,
        daily_avg=MacroTotals(**{k: round(v / num_days, 1) for k, v in macro_totals.items()}),
        daily_calories=daily_cal_list,
        daily_water=[DailyWater(date=d, total_ml=round(v, 1)) for d, v in sorted(daily_water.items())],
        daily_caffeine=[DailyCaffeine(date=d, total_mg=round(v, 1)) for d, v in sorted(daily_caffeine.items())],
        micronutrient_avg=MicronutrientAverages(
            **{f: round(micro_totals[f] / num_days, 2) if micro_totals[f] > 0 else None for f in micro_fields}
        ),
        weight=WeightDelta(start_kg=start_kg, end_kg=end_kg, delta=delta),
        body_comp=body_comp,
    )


async def get_stats_summary(db: AsyncSession, user: User, days: int = 90) -> StatsSummary:
    end = today_for(user)
    start = end - timedelta(days=days - 1)

    # Weight history
    stmt = (
        select(WeightLog)
        .where(WeightLog.user_id == user.id, WeightLog.date >= start)
        .order_by(WeightLog.date.asc())
    )
    result = await db.execute(stmt)
    weight_logs = result.scalars().all()
    weight_history = _aggregate_weight_per_day(weight_logs)

    # Daily calorie data
    stmt = (
        select(FoodLog)
        .where(FoodLog.user_id == user.id, FoodLog.date >= start)
        .options(joinedload(FoodLog.food).joinedload(Food.nutrients))
    )
    result = await db.execute(stmt)
    food_logs = result.unique().scalars().all()

    daily_data: dict[date, dict] = defaultdict(lambda: {"kcal": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0, "fiber": 0.0, "sugar": 0.0, "sodium": 0.0, "alcohol": 0.0})
    daily_caffeine_data: dict[date, float] = defaultdict(float)
    for log in food_logs:
        ratio = log.quantity_g / 100.0
        n = log.food.nutrients
        if not n:
            continue
        d = daily_data[log.date]
        d["kcal"] += (n.kcal or 0) * ratio
        d["protein"] += (n.protein or 0) * ratio
        d["carbs"] += (n.carbs or 0) * ratio
        d["fat"] += (n.fat or 0) * ratio
        d["fiber"] += (n.fiber or 0) * ratio
        d["sugar"] += (n.sugar or 0) * ratio
        d["sodium"] += ((n.salt or 0) * 400) * ratio
        d["alcohol"] += (getattr(n, "alcohol", None) or 0) * ratio
        daily_caffeine_data[log.date] += (getattr(n, "caffeine_mg", None) or 0) * ratio

    daily_nutrition = [
        DailyNutrition(
            date=d,
            kcal=round(v["kcal"], 1),
            protein=round(v["protein"], 1),
            carbs=round(v["carbs"], 1),
            fat=round(v["fat"], 1),
            fiber=round(v["fiber"], 1),
            sugar=round(v["sugar"], 1),
            sodium=round(v["sodium"], 1),
            alcohol=round(v["alcohol"], 1),
        )
        for d, v in sorted(daily_data.items())
    ]

    # Daily micronutrients
    micro_fields = ["calcium", "potassium", "omega3", "zinc", "vit_d", "vit_c", "magnesium", "b12", "iron"]
    daily_micros_data: dict[date, dict] = defaultdict(lambda: {f: 0.0 for f in micro_fields})
    for log in food_logs:
        ratio = log.quantity_g / 100.0
        n = log.food.nutrients
        if not n:
            continue
        for field in micro_fields:
            val = getattr(n, field, None)
            if val is not None:
                daily_micros_data[log.date][field] += val * ratio

    # Add supplement micronutrient contributions per day
    # (Supplement logs are fetched below; fetch them here first for micros)
    stmt = select(Supplement).where(Supplement.user_id == user.id, Supplement.date >= start)
    result = await db.execute(stmt)
    all_supps = result.scalars().all()

    result = await db.execute(
        select(SupplementDefinition).where(SupplementDefinition.user_id == user.id)
    )
    supp_defs = {d.name.lower(): d for d in result.scalars().all()}

    for s in all_supps:
        defn = supp_defs.get(s.name.lower())
        if not defn or not defn.micronutrients:
            continue
        for supp_key, value in defn.micronutrients.items():
            mapped_key = SUPP_MICRO_KEY_MAP.get(supp_key, supp_key)
            if mapped_key in micro_fields and isinstance(value, (int, float)):
                daily_micros_data[s.date][mapped_key] += value

    daily_micros = [
        DailyMicros(
            date=d,
            **{f: round(vals[f], 2) if vals[f] > 0 else None for f in micro_fields},
        )
        for d, vals in sorted(daily_micros_data.items())
    ]

    # Micro averages over the period
    num_micro_days = max(len(daily_micros_data), 1)
    micro_sums: dict[str, float] = {f: 0.0 for f in micro_fields}
    for vals in daily_micros_data.values():
        for f in micro_fields:
            micro_sums[f] += vals[f]
    micro_avg = MicronutrientAverages(
        **{f: round(micro_sums[f] / num_micro_days, 2) if micro_sums[f] > 0 else None for f in micro_fields}
    )

    # Macro averages
    num_days_logged = max(len(daily_data), 1)
    macro_sums = {"kcal": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0, "fiber": 0.0, "sugar": 0.0, "sodium": 0.0, "alcohol": 0.0}
    for d in daily_data.values():
        for k in macro_sums:
            macro_sums[k] += d[k]
    macro_avg = MacroTotals(**{k: round(v / num_days_logged, 1) for k, v in macro_sums.items()})
    avg_daily_kcal = round(macro_sums["kcal"] / num_days_logged, 1)

    # Records
    highest_protein = None
    lowest_calorie = None
    highest_calorie = None
    best_fiber = None
    for d, v in daily_data.items():
        if highest_protein is None or v["protein"] > highest_protein["protein"]:
            highest_protein = {"date": str(d), "protein": round(v["protein"], 1)}
        if lowest_calorie is None or (v["kcal"] > 0 and v["kcal"] < lowest_calorie["kcal"]):
            lowest_calorie = {"date": str(d), "kcal": round(v["kcal"], 1)}
        if highest_calorie is None or v["kcal"] > highest_calorie["kcal"]:
            highest_calorie = {"date": str(d), "kcal": round(v["kcal"], 1)}
        if best_fiber is None or v["fiber"] > best_fiber["fiber"]:
            best_fiber = {"date": str(d), "fiber": round(v["fiber"], 1)}

    # Streak: consecutive days with food logs ending today
    streak = 0
    check_date = end
    while check_date in daily_data:
        streak += 1
        check_date -= timedelta(days=1)

    # Supplement log and adherence (reuse all_supps fetched above for micros)
    supp_by_date: dict[date, list[str]] = defaultdict(list)
    for s in all_supps:
        supp_by_date[s.date].append(s.name)
    supplement_log = [
        SupplementLogEntry(date=d, count=len(names), names=names)
        for d, names in sorted(supp_by_date.items())
    ]
    supp_days = len(supp_by_date)
    adherence = round((supp_days / days) * 100, 1)

    # Water logs for stats period
    stmt = select(WaterLog).where(WaterLog.user_id == user.id, WaterLog.date >= start)
    result = await db.execute(stmt)
    daily_water_data: dict[date, float] = defaultdict(float)
    for w in result.scalars().all():
        daily_water_data[w.date] += w.amount_ml

    return StatsSummary(
        weight_history=weight_history,
        daily_nutrition=daily_nutrition,
        daily_micros=daily_micros,
        supplement_log=supplement_log,
        macro_avg=macro_avg,
        micro_avg=micro_avg,
        days_logged=len(daily_data),
        total_days=days,
        supplement_adherence_pct=adherence,
        highest_protein_day=highest_protein,
        lowest_calorie_day=lowest_calorie,
        highest_calorie_day=highest_calorie,
        best_fiber_day=best_fiber,
        daily_water=[DailyWater(date=d, total_ml=round(v, 1)) for d, v in sorted(daily_water_data.items())],
        daily_caffeine=[DailyCaffeine(date=d, total_mg=round(v, 1)) for d, v in sorted(daily_caffeine_data.items())],
        avg_water_ml=round(sum(daily_water_data.values()) / max(len(daily_water_data), 1), 1),
        avg_caffeine_mg=round(sum(daily_caffeine_data.values()) / max(len(daily_caffeine_data), 1), 1),
        avg_daily_kcal=avg_daily_kcal,
        current_streak=streak,
    )
