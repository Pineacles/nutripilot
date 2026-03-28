from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_api_key
from app.database import get_db
from app.models.user import User
from app.schemas.food_log import FoodLogByBarcodeCreate, FoodLogCreate, FoodLogResponse
from app.schemas.supplement import SupplementCreate, SupplementResponse
from app.schemas.summary import TodaySummary, WeekSummary
from app.schemas.weight_log import WeightLogCreate, WeightLogResponse
from app.services import barcode_service, food_service, logging_service, summary_service

router = APIRouter(prefix="/api/agent", tags=["agent"])


@router.post("/log/food", response_model=FoodLogResponse, status_code=status.HTTP_201_CREATED)
async def log_food(
    body: FoodLogCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    food = await food_service.get_food_by_id(db, body.food_id)
    if food is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food not found")

    entry = await logging_service.log_food(db, user.id, food.id, body.quantity_g, body.meal_type, body.date)

    n = food.nutrients
    ratio = body.quantity_g / 100.0
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
    )


@router.post("/log/food-by-barcode", response_model=FoodLogResponse, status_code=status.HTTP_201_CREATED)
async def log_food_by_barcode(
    body: FoodLogByBarcodeCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    food = await barcode_service.lookup_barcode(db, body.barcode)
    if food is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food not found for barcode")

    entry = await logging_service.log_food(db, user.id, food.id, body.quantity_g, body.meal_type, body.date)

    n = food.nutrients
    ratio = body.quantity_g / 100.0
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
    )


@router.post("/log/supplement", response_model=SupplementResponse, status_code=status.HTTP_201_CREATED)
async def log_supplement(
    body: SupplementCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
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


@router.post("/log/weight", response_model=WeightLogResponse, status_code=status.HTTP_201_CREATED)
async def log_weight(
    body: WeightLogCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    entry = await logging_service.log_weight(db, user.id, body.weight_kg, body.body_fat_pct, "manual", body.date)
    return WeightLogResponse(
        id=entry.id,
        weight_kg=entry.weight_kg,
        body_fat_pct=entry.body_fat_pct,
        source=entry.source,
        date=entry.date,
    )


@router.get("/summary/today", response_model=TodaySummary)
async def summary_today(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    return await summary_service.get_today_summary(db, user)


@router.get("/summary/week", response_model=WeekSummary)
async def summary_week(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    return await summary_service.get_week_summary(db, user)
