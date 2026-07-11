from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_jwt_or_api_key
from app.database import get_db
from app.models.food_log import FoodLog
from app.models.user import User
from app.schemas.food_log import (
    DailyLogResponse,
    FoodLogByBarcodeCreate,
    FoodLogByNameCreate,
    FoodLogCreate,
    FoodLogResponse,
    FoodLogUpdate,
)
from app.services import barcode_service, food_service, logging_service
from app.services.clock import today_for

router = APIRouter()


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


def food_log_response(entry: FoodLog, food) -> FoodLogResponse:
    """Build a FoodLogResponse for a food log entry and its (possibly None) food.

    Shared by log_food, log_food_by_barcode, log_food_by_name, and update_food_log
    so the consumed-nutrients calculation lives in exactly one place.
    """
    n = food.nutrients if food else None
    ratio = entry.quantity_g / 100.0
    return FoodLogResponse(
        id=entry.id,
        food_name=food.name if food else "Unknown",
        quantity_g=entry.quantity_g,
        meal_type=entry.meal_type,
        date=entry.date,
        kcal=round((n.kcal or 0) * ratio, 1) if n else None,
        protein=round((n.protein or 0) * ratio, 1) if n else None,
        carbs=round((n.carbs or 0) * ratio, 1) if n else None,
        fat=round((n.fat or 0) * ratio, 1) if n else None,
        serving_size_g=food.serving_size_g if food else None,
        serving_label=food.serving_label if food else None,
    )


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
    entry = await logging_service.log_food(db, user.id, food.id, quantity_g, body.meal_type, body.date or today_for(user))
    return food_log_response(entry, food)


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
    entry = await logging_service.log_food(db, user.id, food.id, quantity_g, body.meal_type, body.date or today_for(user))
    return food_log_response(entry, food)


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
    entry = await logging_service.log_food(db, user.id, food.id, quantity_g, body.meal_type, body.date or today_for(user))
    return food_log_response(entry, food)


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
    from app.schemas.food_log import FoodLogDetail, NutrientsPer100g

    target_date = day or today_for(user)
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
    return food_log_response(log, food)


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
