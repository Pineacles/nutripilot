from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_jwt_or_api_key
from app.database import get_db
from app.models.caffeine_log import CaffeineLog
from app.models.food_log import FoodLog
from app.models.integration import Integration
from app.models.micronutrient_target import MicronutrientTarget
from app.models.supplement import Supplement
from app.models.supplement_definition import SupplementDefinition
from app.models.user import User
from app.models.water_log import WaterLog
from app.models.weight_log import WeightLog
from app.schemas.food_log import DailyLogResponse, FoodLogByBarcodeCreate, FoodLogByNameCreate, FoodLogCreate, FoodLogResponse, FoodLogUpdate
from app.schemas.integration import (
    IntegrationCreate,
    IntegrationResponse,
    IntegrationUpdate,
    REDACTED_SENTINEL,
    _validate_field_mapping,
)
from app.schemas.settings import (
    MicronutrientTargetItem,
    MicronutrientTargetsUpdate,
    NutritionTargetsResponse,
    NutritionTargetsUpdate,
    SupplementDefinitionCreate,
    SupplementDefinitionResponse,
    SupplementDefinitionUpdate,
    UserSettingsResponse,
)
from app.schemas.supplement import SupplementCreate, SupplementLogUpdate, SupplementResponse
from app.schemas.summary import StatsSummary, TodaySummary, WeekSummary
from app.schemas.caffeine_log import CaffeineLogCreate, CaffeineLogResponse, CaffeineLogUpdate
from app.schemas.water_log import WaterLogCreate, WaterLogResponse, WaterLogUpdate
from app.schemas.weight_log import WeightLogCreate, WeightLogResponse, WeightLogUpdate
from app.services import barcode_service, food_service, logging_service, summary_service
from app.services.nutrient_sources import get_nutrient_sources
from app.services.url_guard import UnsafeURLError, assert_public_http_url

router = APIRouter(prefix="/api/agent", tags=["agent"])


async def _validate_integration_urls(source_url: str | None, field_mapping: dict | None) -> None:
    """SSRF guard for integration source_url and field_mapping.token_url.

    Raises HTTPException(422) with a clear detail if either URL resolves to
    a non-public address.
    """
    if source_url:
        try:
            await assert_public_http_url(source_url, field="source_url")
        except UnsafeURLError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
    token_url = (field_mapping or {}).get("token_url")
    if token_url:
        try:
            await assert_public_http_url(token_url, field="field_mapping.token_url")
        except UnsafeURLError as exc:
            raise HTTPException(status_code=422, detail=str(exc))


def _resolve_quantity(quantity_g, servings, serving_size_g) -> float:
    """Resolve the quantity (in grams) from the provided log request fields.

    Priority: quantity_g → servings × serving_size_g → servings × 100 → 100g fallback.
    """
    if quantity_g is not None:
        return quantity_g
    if servings is not None and serving_size_g:
        return servings * serving_size_g
    if servings is not None:
        return servings * 100
    return 100


@router.post(
    "/log/food",
    response_model=FoodLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log food by ID",
    description=(
        "Log a food entry by its UUID. Use this when you already have the food_id from a prior search or barcode lookup.\n\n"
        "**Quantity resolution:** `quantity_g` wins → else `servings × serving_size_g` → else `servings × 100` → else `100g`.\n\n"
        "**Returns:** the created log with calculated kcal, protein, carbs, and fat for the actual quantity consumed.\n\n"
        "**Errors:** `404 FOOD_NOT_FOUND` if the food_id doesn't exist."
    ),
)
async def log_food(
    body: FoodLogCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    food = await food_service.get_food_by_id(db, body.food_id)
    if food is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Food not found", "code": "FOOD_NOT_FOUND"},
        )

    quantity_g = _resolve_quantity(body.quantity_g, body.servings, food.serving_size_g)
    entry = await logging_service.log_food(db, user.id, food.id, quantity_g, body.meal_type, body.date)

    n = food.nutrients
    ratio = quantity_g / 100.0
    return FoodLogResponse(
        id=entry.id,
        food_name=food.name,
        quantity_g=entry.quantity_g,
        meal_type=entry.meal_type,
        date=entry.date,
        kcal=round((n.kcal or 0) * ratio, 1) if n else None,
        protein=round((n.protein or 0) * ratio, 1) if n else None,
        carbs=round((n.carbs or 0) * ratio, 1) if n else None,
        fat=round((n.fat or 0) * ratio, 1) if n else None,
        serving_size_g=food.serving_size_g,
        serving_label=food.serving_label,
    )


@router.post(
    "/log/food-by-barcode",
    response_model=FoodLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log food by barcode",
    description=(
        "Log a food entry by scanning its barcode. Looks up the barcode in the local database.\n\n"
        "**Quantity resolution:** same as `POST /log/food`.\n\n"
        "**Errors:** `404 BARCODE_NOT_FOUND` if no food matches the barcode. "
        "In that case, create the food first with `POST /api/foods` (include the barcode), then retry."
    ),
)
async def log_food_by_barcode(
    body: FoodLogByBarcodeCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    food = await barcode_service.lookup_barcode(db, body.barcode)
    if food is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Food not found for barcode", "code": "BARCODE_NOT_FOUND", "barcode": body.barcode},
        )

    quantity_g = _resolve_quantity(body.quantity_g, body.servings, food.serving_size_g)
    entry = await logging_service.log_food(db, user.id, food.id, quantity_g, body.meal_type, body.date)

    n = food.nutrients
    ratio = quantity_g / 100.0
    return FoodLogResponse(
        id=entry.id,
        food_name=food.name,
        quantity_g=entry.quantity_g,
        meal_type=entry.meal_type,
        date=entry.date,
        kcal=round((n.kcal or 0) * ratio, 1) if n else None,
        protein=round((n.protein or 0) * ratio, 1) if n else None,
        carbs=round((n.carbs or 0) * ratio, 1) if n else None,
        fat=round((n.fat or 0) * ratio, 1) if n else None,
        serving_size_g=food.serving_size_g,
        serving_label=food.serving_label,
    )


@router.post(
    "/log/food-by-name",
    response_model=FoodLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log food by name (fuzzy match)",
    description=(
        "Log a food entry by name. Performs a fuzzy search and picks the best match.\n\n"
        "**This is the most common endpoint for natural-language food logging.** "
        "Just pass the food name as the user said it.\n\n"
        "**Quantity resolution:** same as `POST /log/food`.\n\n"
        "**Errors:** `404 FOOD_NOT_FOUND_BY_NAME` if no match is found. "
        "The error includes a `suggestion` to create the food first with `POST /api/foods`."
    ),
)
async def log_food_by_name(
    body: FoodLogByNameCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    results = await food_service.search_foods(db, body.food_name, limit=1)
    if not results:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "FOOD_NOT_FOUND_BY_NAME",
                "query": body.food_name,
                "suggestion": "Try creating the food first with POST /api/foods",
            },
        )

    food = await food_service.get_food_by_id(db, results[0]["id"])
    if food is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "FOOD_NOT_FOUND"},
        )

    quantity_g = _resolve_quantity(body.quantity_g, body.servings, food.serving_size_g)
    entry = await logging_service.log_food(db, user.id, food.id, quantity_g, body.meal_type, body.date)

    n = food.nutrients
    ratio = quantity_g / 100.0
    return FoodLogResponse(
        id=entry.id,
        food_name=food.name,
        quantity_g=entry.quantity_g,
        meal_type=entry.meal_type,
        date=entry.date,
        kcal=round((n.kcal or 0) * ratio, 1) if n else None,
        protein=round((n.protein or 0) * ratio, 1) if n else None,
        carbs=round((n.carbs or 0) * ratio, 1) if n else None,
        fat=round((n.fat or 0) * ratio, 1) if n else None,
        serving_size_g=food.serving_size_g,
        serving_label=food.serving_label,
    )


@router.post(
    "/log/supplement",
    response_model=SupplementResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log supplement intake",
    description=(
        "Record that the user took a supplement. Provide name, dose, unit, and optionally time of day.\n\n"
        "**Units:** `mg`, `g`, `IU`, `mcg`, `µg`, `ml`.\n\n"
        "**Time of day:** `morning`, `afternoon`, `evening` (optional).\n\n"
        "If the supplement has a matching definition (by name), its micronutrient content "
        "will be automatically included in daily micronutrient totals and nutrient-source queries."
    ),
)
async def log_supplement(
    body: SupplementCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    entry = await logging_service.log_supplement(
        db, user.id, body.name, body.dose_amount, body.dose_unit, body.time_of_day, body.date
    )
    return SupplementResponse(
        id=entry.id,
        name=entry.name,
        dose_amount=entry.dose_amount,
        dose_unit=entry.dose_unit,
        time_of_day=entry.time_of_day,
        date=entry.date,
    )


@router.get(
    "/log/weight",
    response_model=list[WeightLogResponse],
    summary="List weight logs",
    description=(
        "Retrieve weight and body composition entries. Optionally filter by source (e.g. `manual`, `withings`, `garmin`) "
        "and/or date range.\n\n"
        "Returns entries sorted by date ascending."
    ),
)
async def list_weight_logs(
    source: str | None = Query(None, max_length=50),
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    stmt = select(WeightLog).where(WeightLog.user_id == user.id)
    if source:
        stmt = stmt.where(WeightLog.source == source)
    if from_date:
        stmt = stmt.where(WeightLog.date >= from_date)
    if to_date:
        stmt = stmt.where(WeightLog.date <= to_date)
    stmt = stmt.order_by(WeightLog.date.asc(), WeightLog.logged_at.asc())
    result = await db.execute(stmt)
    return [WeightLogResponse.model_validate(w) for w in result.scalars().all()]


@router.get(
    "/log/food",
    response_model=DailyLogResponse,
    summary="List food logs for a day",
    description=(
        "Get all food log entries for a specific date with full nutrient details.\n\n"
        "Each entry includes:\n"
        "- `nutrients_consumed`: macros + micros for the actual quantity eaten\n"
        "- `nutrients_per_100g`: reference values per 100g\n"
        "- Food metadata: name, source, barcode, serving info\n\n"
        "**Use this to review or audit what was logged.** For aggregate totals, use `GET /summary/today` instead."
    ),
)
async def list_food_logs(
    day: date | None = Query(None, description="Date to get logs for (default: today)"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    from sqlalchemy.orm import joinedload as jl
    from app.models.food import Food
    from app.models.nutrient import Nutrient
    from app.schemas.food_log import FoodLogDetail, NutrientsPer100g

    target_date = day or date.today()
    stmt = (
        select(FoodLog)
        .where(FoodLog.user_id == user.id, FoodLog.date == target_date)
        .options(jl(FoodLog.food).joinedload(Food.nutrients))
        .order_by(FoodLog.logged_at.asc())
    )
    result = await db.execute(stmt)
    logs = result.unique().scalars().all()

    entries = []
    total_kcal = 0.0
    for log in logs:
        food = log.food
        n = food.nutrients
        ratio = log.quantity_g / 100.0

        # Nutrients for actual quantity consumed
        consumed = NutrientsPer100g(
            kcal=round((n.kcal or 0) * ratio, 1) if n else None,
            protein=round((n.protein or 0) * ratio, 1) if n else None,
            carbs=round((n.carbs or 0) * ratio, 1) if n else None,
            sugar=round((n.sugar or 0) * ratio, 1) if n else None,
            fiber=round((n.fiber or 0) * ratio, 1) if n else None,
            fat=round((n.fat or 0) * ratio, 1) if n else None,
            sat_fat=round((n.sat_fat or 0) * ratio, 1) if n else None,
            salt=round((n.salt or 0) * ratio, 2) if n else None,
            calcium=round((n.calcium or 0) * ratio, 1) if n else None,
            potassium=round((n.potassium or 0) * ratio, 1) if n else None,
            omega3=round((n.omega3 or 0) * ratio, 1) if n else None,
            zinc=round((n.zinc or 0) * ratio, 2) if n else None,
            vit_d=round((n.vit_d or 0) * ratio, 2) if n else None,
            vit_c=round((n.vit_c or 0) * ratio, 1) if n else None,
            magnesium=round((n.magnesium or 0) * ratio, 1) if n else None,
            b12=round((n.b12 or 0) * ratio, 2) if n else None,
            iron=round((n.iron or 0) * ratio, 2) if n else None,
            alcohol=round((getattr(n, "alcohol", None) or 0) * ratio, 1) if n else None,
        ) if n else NutrientsPer100g()

        # Raw nutrients per 100g
        per_100g = NutrientsPer100g.model_validate(n) if n else None

        total_kcal += consumed.kcal or 0

        entries.append(FoodLogDetail(
            id=log.id,
            food_id=food.id,
            food_name=food.name,
            food_source=food.source,
            barcode=food.barcode,
            serving_size_g=food.serving_size_g,
            serving_label=food.serving_label,
            quantity_g=log.quantity_g,
            meal_type=log.meal_type,
            date=log.date,
            logged_at=log.logged_at,
            nutrients_consumed=consumed,
            nutrients_per_100g=per_100g,
        ))

    return DailyLogResponse(
        date=target_date,
        total_items=len(entries),
        total_kcal=round(total_kcal, 1),
        entries=entries,
    )


@router.post(
    "/log/weight",
    response_model=WeightLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log weight and body composition",
    description=(
        "Record a weight measurement with optional body composition data.\n\n"
        "**Fields:** `weight_kg` (required), `body_fat_pct`, `muscle_mass_pct`, "
        "`body_fat_kg`, `muscle_mass_kg`, `source` (e.g. 'manual', 'withings'), `date`.\n\n"
        "The summary endpoints will automatically average multiple entries on the same day "
        "and derive missing values (e.g. body_fat_kg from body_fat_pct × weight_kg)."
    ),
)
async def log_weight(
    body: WeightLogCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    entry = await logging_service.log_weight(
        db, user.id, body.weight_kg, body.body_fat_pct, body.muscle_mass_pct,
        body.body_fat_kg, body.muscle_mass_kg, body.source or "manual", body.date
    )
    return WeightLogResponse(
        id=entry.id,
        weight_kg=entry.weight_kg,
        body_fat_pct=entry.body_fat_pct,
        muscle_mass_pct=entry.muscle_mass_pct,
        body_fat_kg=entry.body_fat_kg,
        muscle_mass_kg=entry.muscle_mass_kg,
        source=entry.source,
        date=entry.date,
    )


@router.get(
    "/summary/today",
    response_model=TodaySummary,
    summary="Today's full nutrition snapshot",
    description=(
        "Returns everything about today's nutrition in one call:\n\n"
        "- **totals**: aggregated macros (kcal, protein, carbs, fat, fiber, sugar, sodium, alcohol)\n"
        "- **targets**: the user's daily targets for comparison\n"
        "- **meals**: food items grouped by meal type, each with per-item nutrient breakdown\n"
        "- **supplements**: all supplement logs for the day\n"
        "- **water**: total ml consumed vs target\n"
        "- **caffeine**: total mg consumed vs target\n"
        "- **micronutrients**: aggregated micros from food + supplements (calcium, potassium, omega3, zinc, vit_d, vit_k2, vit_c, magnesium, b12, iron)\n\n"
        "**This is the go-to endpoint for answering 'how am I doing today?'**"
    ),
)
async def summary_today(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    return await summary_service.get_today_summary(db, user)


@router.get(
    "/summary/week",
    response_model=WeekSummary,
    summary="Weekly nutrition and body comp summary",
    description=(
        "Returns the last 7 days averaged:\n\n"
        "- **daily_avg**: average macros per day\n"
        "- **daily_calories**: per-day kcal breakdown for charting\n"
        "- **micronutrient_avg**: average daily micros\n"
        "- **weight**: start/end/delta for the period\n"
        "- **body_comp**: daily body composition entries\n"
        "- **daily_water / daily_caffeine**: per-day totals"
    ),
)
async def summary_week(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    return await summary_service.get_week_summary(db, user)


# --- Agent Settings ---

@router.get(
    "/settings",
    response_model=UserSettingsResponse,
    summary="Get all user settings",
    description=(
        "Returns the user's complete settings:\n\n"
        "- **nutrition_targets**: daily targets for kcal, protein, carbs, fat, fiber, sugar, sodium, alcohol, water, caffeine\n"
        "- **micronutrient_targets**: custom targets for micros (e.g. calcium 1000mg)\n"
        "- **supplement_definitions**: configured supplements with dose and micronutrient content\n"
        "- **api_key_masked**: last 6 chars of the API key\n\n"
        "**Always GET settings before updating nutrition targets**, so you can send back all fields (PUT replaces the entire object)."
    ),
)
async def agent_get_settings(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(
        select(MicronutrientTarget).where(MicronutrientTarget.user_id == user.id)
    )
    micro_targets = [
        MicronutrientTargetItem(nutrient=t.nutrient, target_value=t.target_value, unit=t.unit)
        for t in result.scalars().all()
    ]
    result = await db.execute(
        select(SupplementDefinition).where(SupplementDefinition.user_id == user.id)
    )
    supps = result.scalars().all()
    return UserSettingsResponse(
        nutrition_targets=NutritionTargetsResponse(
            target_kcal=user.target_kcal,
            target_protein_g=user.target_protein_g,
            target_carbs_g=user.target_carbs_g,
            target_fat_g=user.target_fat_g,
            target_fiber_g=user.target_fiber_g,
            target_sugar_g=user.target_sugar_g,
            target_sodium_mg=user.target_sodium_mg,
            target_alcohol_g=user.target_alcohol_g,
            target_water_ml=user.target_water_ml,
            target_caffeine_mg=user.target_caffeine_mg,
        ),
        micronutrient_targets=micro_targets,
        supplement_definitions=[SupplementDefinitionResponse.model_validate(s) for s in supps],
        api_key_masked=f"...{user.api_key[-6:]}",
    )


@router.put(
    "/settings/nutrition-targets",
    response_model=NutritionTargetsResponse,
    summary="Update nutrition targets",
    description=(
        "Replace all daily nutrition targets. **All fields are required** — GET settings first to preserve unchanged values.\n\n"
        "Fields: `target_kcal` (1-10000), `target_protein_g` (0-1000), `target_carbs_g` (0-1000), "
        "`target_fat_g` (0-500), `target_fiber_g` (0-200, default 30), `target_sugar_g` (0-500, default 50), "
        "`target_sodium_mg` (0-10000, default 2300), `target_alcohol_g` (0-500), "
        "`target_water_ml` (0-20000), `target_caffeine_mg` (0-5000)."
    ),
)
async def agent_update_nutrition_targets(
    body: NutritionTargetsUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    user.target_kcal = body.target_kcal
    user.target_protein_g = body.target_protein_g
    user.target_carbs_g = body.target_carbs_g
    user.target_fat_g = body.target_fat_g
    user.target_fiber_g = body.target_fiber_g
    user.target_sugar_g = body.target_sugar_g
    user.target_sodium_mg = body.target_sodium_mg
    user.target_alcohol_g = body.target_alcohol_g
    user.target_water_ml = body.target_water_ml
    user.target_caffeine_mg = body.target_caffeine_mg
    await db.commit()
    return NutritionTargetsResponse(
        target_kcal=user.target_kcal,
        target_protein_g=user.target_protein_g,
        target_carbs_g=user.target_carbs_g,
        target_fat_g=user.target_fat_g,
        target_fiber_g=user.target_fiber_g,
        target_sugar_g=user.target_sugar_g,
        target_sodium_mg=user.target_sodium_mg,
        target_alcohol_g=user.target_alcohol_g,
        target_water_ml=user.target_water_ml,
        target_caffeine_mg=user.target_caffeine_mg,
    )


@router.put(
    "/settings/micronutrient-targets",
    response_model=list[MicronutrientTargetItem],
    summary="Replace micronutrient targets",
    description=(
        "Replace ALL micronutrient targets at once (delete + re-insert). "
        "Send the complete list you want — any target not included will be removed.\n\n"
        "Each item: `{nutrient: str, target_value: float (0-100000), unit: str}`.\n\n"
        "Common examples: `{nutrient: 'calcium', target_value: 1000, unit: 'mg'}`, "
        "`{nutrient: 'vit_d', target_value: 50, unit: 'mcg'}`."
    ),
)
async def agent_update_micronutrient_targets(
    body: MicronutrientTargetsUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    await db.execute(
        delete(MicronutrientTarget).where(MicronutrientTarget.user_id == user.id)
    )
    new_targets = []
    for t in body.targets:
        mt = MicronutrientTarget(
            user_id=user.id, nutrient=t.nutrient, target_value=t.target_value, unit=t.unit,
        )
        db.add(mt)
        new_targets.append(t)
    await db.commit()
    return new_targets


@router.get(
    "/supplements",
    response_model=list[SupplementDefinitionResponse],
    summary="List supplement definitions",
    description=(
        "Get all configured supplement definitions. These define what supplements the user takes, "
        "their dose, and which micronutrients they contribute.\n\n"
        "Supplement definitions are separate from supplement logs — "
        "definitions describe *what* the user takes, logs record *when* they took it."
    ),
)
async def agent_list_supplements(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(
        select(SupplementDefinition).where(SupplementDefinition.user_id == user.id)
    )
    return [SupplementDefinitionResponse.model_validate(s) for s in result.scalars().all()]


@router.post(
    "/supplements",
    response_model=SupplementDefinitionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create supplement definition",
    description=(
        "Define a new supplement the user takes regularly.\n\n"
        "**micronutrients** (optional dict) maps nutrient keys to amounts per dose. "
        "Use these keys: `vitamin_d`, `zinc`, `omega3`, `iron`, `calcium`, `magnesium`, `b12`, `vit_c`, `potassium`.\n\n"
        "Example: `{name: 'Vitamin D3', dose_amount: 4000, dose_unit: 'IU', micronutrients: {vitamin_d: 100}}`\n\n"
        "When the user logs this supplement, its micronutrient content is automatically counted in daily totals."
    ),
)
async def agent_create_supplement(
    body: SupplementDefinitionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    supp = SupplementDefinition(
        user_id=user.id, name=body.name, dose_amount=body.dose_amount,
        dose_unit=body.dose_unit, time_of_day=body.time_of_day, micronutrients=body.micronutrients,
    )
    db.add(supp)
    await db.commit()
    await db.refresh(supp)
    return SupplementDefinitionResponse.model_validate(supp)


@router.put(
    "/supplements/{supp_id}",
    response_model=SupplementDefinitionResponse,
    summary="Update supplement definition",
    description="Update any field on a supplement definition. Only send the fields you want to change.",
)
async def agent_update_supplement(
    supp_id: UUID,
    body: SupplementDefinitionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(
        select(SupplementDefinition).where(
            SupplementDefinition.id == supp_id, SupplementDefinition.user_id == user.id,
        )
    )
    supp = result.scalar_one_or_none()
    if supp is None:
        raise HTTPException(status_code=404, detail="Supplement not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(supp, field, value)
    await db.commit()
    await db.refresh(supp)
    return SupplementDefinitionResponse.model_validate(supp)


@router.delete(
    "/supplements/{supp_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete supplement definition",
    description="Permanently remove a supplement definition. This does NOT delete past supplement logs.",
)
async def agent_delete_supplement(
    supp_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(
        select(SupplementDefinition).where(
            SupplementDefinition.id == supp_id, SupplementDefinition.user_id == user.id,
        )
    )
    supp = result.scalar_one_or_none()
    if supp is None:
        raise HTTPException(status_code=404, detail="Supplement not found")
    await db.delete(supp)
    await db.commit()


# --- Food Log CRUD ---

@router.put(
    "/log/food/{log_id}",
    response_model=FoodLogResponse,
    summary="Update a food log entry",
    description="Change quantity, meal type, or date on an existing food log. Only send the fields you want to change.",
)
async def update_food_log(
    log_id: UUID,
    body: FoodLogUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(select(FoodLog).where(FoodLog.id == log_id, FoodLog.user_id == user.id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail={"code": "LOG_NOT_FOUND"})
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(log, field, value)
    await db.commit()
    await db.refresh(log)
    food = await food_service.get_food_by_id(db, log.food_id)
    n = food.nutrients if food else None
    ratio = log.quantity_g / 100.0
    return FoodLogResponse(
        id=log.id, food_name=food.name if food else "Unknown",
        quantity_g=log.quantity_g, meal_type=log.meal_type, date=log.date,
        kcal=round((n.kcal or 0) * ratio, 1) if n else None,
        protein=round((n.protein or 0) * ratio, 1) if n else None,
        carbs=round((n.carbs or 0) * ratio, 1) if n else None,
        fat=round((n.fat or 0) * ratio, 1) if n else None,
        serving_size_g=food.serving_size_g if food else None,
        serving_label=food.serving_label if food else None,
    )


@router.delete(
    "/log/food/{log_id}",
    status_code=204,
    summary="Delete a food log entry",
    description="Permanently remove a food log entry. Use this when the user says they didn't actually eat something.",
)
async def delete_food_log(
    log_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(select(FoodLog).where(FoodLog.id == log_id, FoodLog.user_id == user.id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail={"code": "LOG_NOT_FOUND"})
    await db.delete(log)
    await db.commit()


# --- Weight Log CRUD ---

@router.put(
    "/log/weight/{log_id}",
    response_model=WeightLogResponse,
    summary="Update a weight log entry",
    description="Change weight, body fat, or muscle mass on an existing weight log. Only send the fields you want to change.",
)
async def update_weight_log(
    log_id: UUID,
    body: WeightLogUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(select(WeightLog).where(WeightLog.id == log_id, WeightLog.user_id == user.id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail={"code": "LOG_NOT_FOUND"})
    updates = body.model_dump(exclude_unset=True)
    new_date = updates.pop("log_date", None)
    if new_date is not None:
        if log.source != "manual":
            raise HTTPException(
                status_code=422,
                detail={"code": "SYNCED_LOG_DATE_IMMUTABLE", "detail": "date of synced entries cannot be changed"},
            )
        log.date = new_date
    for field, value in updates.items():
        setattr(log, field, value)
    await db.commit()
    await db.refresh(log)
    return WeightLogResponse(
        id=log.id,
        weight_kg=log.weight_kg,
        body_fat_pct=log.body_fat_pct,
        muscle_mass_pct=log.muscle_mass_pct,
        body_fat_kg=log.body_fat_kg,
        muscle_mass_kg=log.muscle_mass_kg,
        source=log.source,
        date=log.date,
    )


@router.delete(
    "/log/weight/{log_id}",
    status_code=204,
    summary="Delete a weight log entry",
    description="Permanently remove a weight log entry.",
)
async def delete_weight_log(
    log_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(select(WeightLog).where(WeightLog.id == log_id, WeightLog.user_id == user.id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail={"code": "LOG_NOT_FOUND"})
    await db.delete(log)
    await db.commit()


# --- Supplement Log CRUD ---

@router.put(
    "/log/supplement/{log_id}",
    response_model=SupplementResponse,
    summary="Update a supplement log entry",
    description="Change name, dose, unit, time of day, or date on an existing supplement log.",
)
async def update_supplement_log(
    log_id: UUID,
    body: SupplementLogUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(select(Supplement).where(Supplement.id == log_id, Supplement.user_id == user.id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail={"code": "LOG_NOT_FOUND"})
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(log, field, value)
    await db.commit()
    await db.refresh(log)
    return SupplementResponse(
        id=log.id,
        name=log.name,
        dose_amount=log.dose_amount,
        dose_unit=log.dose_unit,
        time_of_day=log.time_of_day,
        date=log.date,
    )


@router.delete(
    "/log/supplement/{log_id}",
    status_code=204,
    summary="Delete a supplement log entry",
    description="Permanently remove a supplement log entry.",
)
async def delete_supplement_log(
    log_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(select(Supplement).where(Supplement.id == log_id, Supplement.user_id == user.id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail={"code": "LOG_NOT_FOUND"})
    await db.delete(log)
    await db.commit()


# --- Water Logging ---

@router.post(
    "/log/water",
    response_model=WaterLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log water intake",
    description="Record water consumption in milliliters. Common: glass = 250ml, bottle = 500ml, large bottle = 1000ml.",
)
async def log_water(
    body: WaterLogCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    entry = await logging_service.log_water(db, user.id, body.amount_ml, body.date)
    return WaterLogResponse.model_validate(entry)


@router.put(
    "/log/water/{log_id}",
    response_model=WaterLogResponse,
    summary="Update a water log entry",
    description="Change the amount on an existing water log.",
)
async def update_water_log(
    log_id: UUID,
    body: WaterLogUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(select(WaterLog).where(WaterLog.id == log_id, WaterLog.user_id == user.id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail={"code": "LOG_NOT_FOUND"})
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(log, field, value)
    await db.commit()
    await db.refresh(log)
    return WaterLogResponse.model_validate(log)


@router.delete(
    "/log/water/{log_id}",
    status_code=204,
    summary="Delete a water log entry",
    description="Permanently remove a water log entry.",
)
async def delete_water_log(
    log_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(select(WaterLog).where(WaterLog.id == log_id, WaterLog.user_id == user.id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail={"code": "LOG_NOT_FOUND"})
    await db.delete(log)
    await db.commit()


# --- Caffeine Logging (DEPRECATED) ---

@router.post(
    "/log/caffeine",
    response_model=CaffeineLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="DEPRECATED — Log caffeine intake",
    description=(
        "**DEPRECATED: Caffeine is now tracked automatically through food nutrients.** "
        "Instead of using this endpoint, log a caffeinated food/drink via `POST /log/food-by-name` "
        "(e.g. 'espresso', 'coffee', 'energy drink', 'green tea'). Foods with caffeine data will "
        "automatically count toward the user's daily caffeine total.\n\n"
        "If a food doesn't have caffeine data yet, create it with `POST /api/foods` and include "
        "`caffeine_mg` in the nutrients object (value per 100g)."
    ),
    deprecated=True,
)
async def log_caffeine(
    body: CaffeineLogCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    entry = await logging_service.log_caffeine(db, user.id, body.amount_mg, body.source_name, body.date)
    return CaffeineLogResponse.model_validate(entry)


@router.put(
    "/log/caffeine/{log_id}",
    response_model=CaffeineLogResponse,
    summary="DEPRECATED — Update a caffeine log entry",
    description="**DEPRECATED.** Caffeine is now tracked through food nutrients. Use food log endpoints instead.",
    deprecated=True,
)
async def update_caffeine_log(
    log_id: UUID,
    body: CaffeineLogUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(select(CaffeineLog).where(CaffeineLog.id == log_id, CaffeineLog.user_id == user.id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail={"code": "LOG_NOT_FOUND"})
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(log, field, value)
    await db.commit()
    await db.refresh(log)
    return CaffeineLogResponse.model_validate(log)


@router.delete(
    "/log/caffeine/{log_id}",
    status_code=204,
    summary="DEPRECATED — Delete a caffeine log entry",
    description="**DEPRECATED.** Caffeine is now tracked through food nutrients. Use food log endpoints instead.",
    deprecated=True,
)
async def delete_caffeine_log(
    log_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(select(CaffeineLog).where(CaffeineLog.id == log_id, CaffeineLog.user_id == user.id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail={"code": "LOG_NOT_FOUND"})
    await db.delete(log)
    await db.commit()


# --- Stats ---

@router.get(
    "/summary/stats",
    response_model=StatsSummary,
    summary="Long-range stats (1-365 days)",
    description=(
        "Comprehensive statistics over a configurable period (default 90 days).\n\n"
        "Includes:\n"
        "- **weight_history / body_comp**: daily body composition trend\n"
        "- **daily_nutrition**: per-day macro breakdown\n"
        "- **daily_micros**: per-day micronutrient breakdown\n"
        "- **macro_avg / micro_avg**: period averages\n"
        "- **supplement_log / supplement_adherence_pct**: consistency tracking\n"
        "- **daily_water / daily_caffeine / avg_water_ml / avg_caffeine_mg**: hydration and caffeine trends\n"
        "- **Records**: highest_protein_day, lowest/highest_calorie_day, best_fiber_day\n"
        "- **current_streak**: consecutive days with food logged ending today\n"
        "- **days_logged / total_days**: how many days have data vs period length"
    ),
)
async def agent_stats(
    days: int = Query(90, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    return await summary_service.get_stats_summary(db, user, days)


# --- Integrations (agent-managed) ---

@router.get(
    "/integrations",
    response_model=list[IntegrationResponse],
    summary="List integrations",
    description=(
        "Get all configured integrations (smart scales, external APIs). Sorted by newest first.\n\n"
        "Check the `status` field: `active` = working, `error` = temporary failure (will retry), "
        "`needs_reauth` = tokens expired (user must re-authorize), `paused` = manually paused.\n\n"
        "To fetch latest data from a scale, use `POST /api/agent/integrations/{id}/sync`."
    ),
)
async def agent_list_integrations(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(
        select(Integration).where(Integration.user_id == user.id).order_by(Integration.created_at.desc())
    )
    return [IntegrationResponse.model_validate(i) for i in result.scalars().all()]


@router.post(
    "/integrations",
    response_model=IntegrationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create integration (connect a smart scale or API)",
    description=(
        "Connect an external data source. The `field_mapping` object tells the sync worker how to map vendor data to NutriPilot fields.\n\n"
        "**Supported types:** `withings_measure`, `fitbit_body`, `google_fit`, `garmin_body`, `generic_json`.\n\n"
        "See the `field_mapping` field schema for complete documentation on each integration type, "
        "including OAuth flows, required keys, measure_map values, error codes, and rate limits.\n\n"
        "**WARNING:** After creating an integration, NEVER call the provider's API directly. "
        "Use `POST /api/agent/integrations/{id}/sync` to fetch data. Calling provider APIs directly "
        "will consume OAuth refresh tokens and permanently break the integration."
    ),
)
async def agent_create_integration(
    body: IntegrationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    await _validate_integration_urls(body.source_url, body.field_mapping)
    integration = Integration(
        user_id=user.id,
        name=body.name,
        source_url=body.source_url,
        auth_header=body.auth_header,
        schedule=body.schedule,
        field_mapping=body.field_mapping,
        status="active",
    )
    db.add(integration)
    await db.commit()
    await db.refresh(integration)
    return IntegrationResponse.model_validate(integration)


@router.patch(
    "/integrations/{integration_id}",
    response_model=IntegrationResponse,
    summary="Update integration",
    description=(
        "Update any field on an integration. Only send the fields you want to change.\n\n"
        "**status** can be set to `active`, `paused`, or `error`."
    ),
)
async def agent_update_integration(
    integration_id: UUID,
    body: IntegrationUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(
        select(Integration).where(Integration.id == integration_id, Integration.user_id == user.id)
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail={"code": "INTEGRATION_NOT_FOUND"})
    updates = body.model_dump(exclude_unset=True)
    # If the caller sends a field_mapping that contains REDACTED_SENTINEL values,
    # keep the existing (stored) secret values rather than overwriting them.
    if "field_mapping" in updates and updates["field_mapping"] is not None:
        existing_fm = integration.field_mapping or {}
        merged = dict(existing_fm)
        for k, v in updates["field_mapping"].items():
            if v == REDACTED_SENTINEL:
                # Caller is echoing back our redaction — preserve stored secret
                pass
            else:
                merged[k] = v
        updates["field_mapping"] = merged

        # Validate the MERGED mapping (same rules as IntegrationCreate).
        # Must run on the merged result, not the raw PATCH body — a partial
        # update may only send one changed key while relying on stored
        # values (including sentinel-preserved secrets) for the rest.
        errors = _validate_field_mapping(merged)
        if errors:
            raise HTTPException(
                status_code=422,
                detail={"code": "INVALID_FIELD_MAPPING", "errors": errors},
            )

    # SSRF guard on the merged result (source_url may come from this PATCH
    # or, if unset, from the already-stored integration).
    merged_source_url = updates.get("source_url", integration.source_url)
    merged_field_mapping = updates.get("field_mapping", integration.field_mapping)
    await _validate_integration_urls(merged_source_url, merged_field_mapping)

    for field, value in updates.items():
        setattr(integration, field, value)
    await db.commit()
    await db.refresh(integration)
    return IntegrationResponse.model_validate(integration)


@router.delete(
    "/integrations/{integration_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete integration",
    description="Permanently remove an integration. Past weight logs synced by this integration are NOT deleted.",
)
async def agent_delete_integration(
    integration_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(
        select(Integration).where(Integration.id == integration_id, Integration.user_id == user.id)
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail={"code": "INTEGRATION_NOT_FOUND"})
    await db.delete(integration)
    await db.commit()


@router.post(
    "/integrations/{integration_id}/sync",
    summary="Trigger manual sync (fetch latest data from scale/device)",
    description=(
        "Manually trigger a data sync for an integration right now. "
        "This is the **correct way** to fetch the latest data from Withings, Fitbit, Google Fit, Garmin, etc.\n\n"
        "**IMPORTANT: Never call external provider APIs (Withings, Fitbit, etc.) directly.** "
        "Doing so will consume OAuth tokens and permanently break the integration. "
        "Always use this endpoint instead — it safely handles token refresh, API calls, "
        "and data storage in one atomic operation.\n\n"
        "**When to use:**\n"
        "- User says 'sync my scale', 'get my latest weight', 'fetch data from Withings'\n"
        "- User wants to see recent weigh-in data that hasn't been synced yet\n"
        "- After setting up a new integration to pull initial data\n\n"
        "**Returns** `{ok: true, entries_synced: N}` on success.\n\n"
        "**Errors:**\n"
        "- `404 INTEGRATION_NOT_FOUND` — wrong ID or not owned by this user\n"
        "- `502 SYNC_FAILED` — sync failed (check error details). If `needs_reauth`, "
        "the user must re-authorize through the provider's OAuth flow to get fresh tokens."
    ),
)
async def agent_sync_integration(
    integration_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    from app.services.sync_worker import sync_integration

    # Verify ownership
    result = await db.execute(
        select(Integration).where(Integration.id == integration_id, Integration.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail={"code": "INTEGRATION_NOT_FOUND"})

    sync_result = await sync_integration(integration_id)
    if not sync_result.get("ok"):
        raise HTTPException(
            status_code=502,
            detail={"code": "SYNC_FAILED", "error": sync_result.get("error", "Unknown error")},
        )
    return sync_result


@router.get(
    "/nutrient-sources",
    summary="Find nutrient sources",
    description=(
        "Find which foods and supplements contributed to a specific nutrient, ranked by amount (top 30).\n\n"
        "**Nutrient keys:** Any macro (`protein`, `carbs`, `fat`, `fiber`, `sugar`, `sodium`, `alcohol`, `caffeine_mg`) "
        "or micro (`calcium`, `potassium`, `omega3`, `zinc`, `vit_d`, `vit_c`, `magnesium`, `b12`, `iron`).\n\n"
        "Supplements with matching micronutrient definitions are included automatically.\n\n"
        "**Returns:** `{nutrient, from_date, to_date, total, sources: [{food_name, quantity_g, amount, date, meal_type}]}`"
    ),
)
async def agent_nutrient_sources(
    nutrient: str = Query(..., description="Nutrient field name, e.g. 'zinc', 'protein', 'vit_d'"),
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    """Get foods that contributed to a specific nutrient, ranked by amount."""
    target_from = from_date or date.today()
    target_to = to_date or date.today()
    return await get_nutrient_sources(db, user, nutrient, target_from, target_to)
