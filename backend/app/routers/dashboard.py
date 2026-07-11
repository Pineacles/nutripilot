from datetime import date
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
from app.schemas.food import FoodResponse, NutrientData
from app.schemas.summary import StatsSummary, TodaySummary, WeekSummary
from app.services import summary_service
from app.services.clock import today_for
from app.services.nutrient_sources import get_nutrient_sources

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/today", response_model=TodaySummary)
async def dashboard_today(
    date: date | None = Query(None, description="Date to view (default: today)"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    return await summary_service.get_today_summary(db, user, target_date=date)


@router.get("/weekly", response_model=WeekSummary)
async def dashboard_weekly(
    mode: str = Query("last7", pattern="^(last7|week)$"),
    offset: int = Query(0, ge=0, le=52, description="Weeks back from current. 0 = this week, 1 = last week, etc."),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    from datetime import timedelta
    if mode == "week":
        today = today_for(user) - timedelta(weeks=offset)
        monday = today - timedelta(days=today.weekday())
        sunday = monday + timedelta(days=6)
        return await summary_service.get_week_summary(db, user, end_date=sunday, start_override=monday)
    end = today_for(user) - timedelta(weeks=offset)
    return await summary_service.get_week_summary(db, user, end_date=end)


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
    from datetime import timedelta

    start = today_for(user) - timedelta(days=days)
    stmt = (
        select(WeightLog)
        .where(WeightLog.user_id == user.id, WeightLog.date >= start)
        .order_by(WeightLog.date.asc())
    )
    result = await db.execute(stmt)
    logs = result.scalars().all()
    return [
        {
            "date": str(log.date), "weight_kg": log.weight_kg,
            "body_fat_pct": log.body_fat_pct, "muscle_mass_pct": log.muscle_mass_pct,
        }
        for log in logs
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

    items = [
        {"id": str(r.id), "name": r.name, "barcode": r.barcode, "source": r.source, "kcal": r.kcal, "protein": r.protein}
        for r in rows
    ]

    # Fall back to OpenFoodFacts if local results are sparse and query is long enough
    if q and len(q) >= 2 and len(items) < 3 and page == 1:
        from app.external.openfoodfacts import search_by_text

        off_results = await search_by_text(q, limit=limit - len(items))
        local_names = {item["name"].lower() for item in items}
        for off_item in off_results:
            if off_item["name"].lower() not in local_names:
                items.append({
                    "id": None,
                    "name": off_item["name"],
                    "barcode": off_item.get("barcode"),
                    "source": "openfoodfacts",
                    "kcal": off_item.get("kcal"),
                    "protein": off_item.get("protein"),
                })

    return {
        "items": items,
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
        raise HTTPException(
            status_code=404,
            detail={"detail": "Food not found", "code": "FOOD_NOT_FOUND"},
        )
    nutrients = None
    if food.nutrients:
        nutrients = NutrientData.model_validate(food.nutrients, from_attributes=True)
    is_mine = food.created_by is not None and food.created_by == user.id
    return FoodResponse(
        id=food.id,
        name=food.name,
        barcode=food.barcode,
        source=food.source,
        serving_size_g=food.serving_size_g,
        serving_label=food.serving_label,
        nutrients=nutrients,
        is_mine=is_mine,
        editable=is_mine,
    )


@router.get("/nutrient-sources")
async def nutrient_sources(
    nutrient: str = Query(..., description="Nutrient field name, e.g. 'zinc', 'protein', 'vit_d'"),
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    """Get foods that contributed to a specific nutrient, ranked by amount."""
    target_from = from_date or today_for(user)
    target_to = to_date or today_for(user)
    return await get_nutrient_sources(db, user, nutrient, target_from, target_to)
