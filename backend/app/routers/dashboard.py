from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_jwt
from app.database import get_db
from app.models.food import Food
from app.models.nutrient import Nutrient
from app.models.user import User
from app.models.weight_log import WeightLog
from app.schemas.food import FoodResponse, FoodSearchResult, NutrientData
from app.schemas.summary import StatsSummary, TodaySummary, WeekSummary
from app.services import summary_service

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/today", response_model=TodaySummary)
async def dashboard_today(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    return await summary_service.get_today_summary(db, user)


@router.get("/weekly", response_model=WeekSummary)
async def dashboard_weekly(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    return await summary_service.get_week_summary(db, user)


@router.get("/stats", response_model=StatsSummary)
async def dashboard_stats(
    days: int = Query(90, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    return await summary_service.get_stats_summary(db, user, days)


@router.get("/weight")
async def dashboard_weight(
    days: int = Query(90, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    from datetime import date, timedelta

    start = date.today() - timedelta(days=days)
    stmt = (
        select(WeightLog)
        .where(WeightLog.user_id == user.id, WeightLog.date >= start)
        .order_by(WeightLog.date.asc())
    )
    result = await db.execute(stmt)
    logs = result.scalars().all()
    return [
        {"date": str(l.date), "weight_kg": l.weight_kg, "body_fat_pct": l.body_fat_pct, "muscle_mass_pct": l.muscle_mass_pct}
        for l in logs
    ]


@router.get("/foods")
async def dashboard_foods(
    q: str = Query("", min_length=0),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    offset = (page - 1) * limit

    if q:
        stmt = (
            select(Food.id, Food.name, Food.barcode, Food.source, Nutrient.kcal, Nutrient.protein)
            .outerjoin(Nutrient, Food.id == Nutrient.food_id)
            .where(func.similarity(Food.name, q) > 0.1)
            .order_by(func.similarity(Food.name, q).desc())
            .offset(offset).limit(limit)
        )
        count_stmt = select(func.count()).select_from(Food).where(func.similarity(Food.name, q) > 0.1)
    else:
        stmt = (
            select(Food.id, Food.name, Food.barcode, Food.source, Nutrient.kcal, Nutrient.protein)
            .outerjoin(Nutrient, Food.id == Nutrient.food_id)
            .order_by(Food.name.asc())
            .offset(offset).limit(limit)
        )
        count_stmt = select(func.count()).select_from(Food)

    result = await db.execute(stmt)
    rows = result.all()
    total = (await db.execute(count_stmt)).scalar() or 0

    return {
        "items": [
            {"id": str(r.id), "name": r.name, "barcode": r.barcode, "source": r.source, "kcal": r.kcal, "protein": r.protein}
            for r in rows
        ],
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


@router.get("/foods/{food_id}")
async def dashboard_food_detail(
    food_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    result = await db.execute(select(Food).where(Food.id == food_id))
    food = result.scalar_one_or_none()
    if food is None:
        raise HTTPException(status_code=404, detail="Food not found")
    nutrients = None
    if food.nutrients:
        nutrients = NutrientData.model_validate(food.nutrients, from_attributes=True)
    return FoodResponse(id=food.id, name=food.name, barcode=food.barcode, source=food.source, nutrients=nutrients)
