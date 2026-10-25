from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_jwt
from app.database import get_db
from app.models.food import Food
from app.models.food_log import FoodLog
from app.models.nutrient import Nutrient
from app.models.user import User
from app.models.weight_log import WeightLog
from app.schemas.food import FoodResponse, NutrientData, ServingResponse
from app.schemas.summary import StatsSummary, TodaySummary, WeekSummary
from app.services import food_service, summary_service
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
    # Foods this user has logged before rank above lookalikes they never ate.
    uses = (
        select(FoodLog.food_id, func.count().label("uses"))
        .where(FoodLog.user_id == user.id)
        .group_by(FoodLog.food_id)
        .subquery()
    )
    columns = (
        Food.id, Food.name, Food.barcode, Food.source, Nutrient.kcal, Nutrient.protein,
        Food.serving_size_g, Food.serving_label, func.coalesce(uses.c.uses, 0).label("uses"),
    )

    if q:
        similarity = func.similarity(Food.name, q)
        stmt = (
            select(*columns)
            .outerjoin(Nutrient, Food.id == Nutrient.food_id)
            .outerjoin(uses, uses.c.food_id == Food.id)
            .where(similarity > 0.1)
            .order_by((similarity + case((uses.c.uses > 0, 0.25), else_=0)).desc(), func.coalesce(uses.c.uses, 0).desc())
            .offset(offset).limit(limit)
        )
        count_stmt = select(func.count()).select_from(Food).where(func.similarity(Food.name, q) > 0.1)
    else:
        stmt = (
            select(*columns)
            .outerjoin(Nutrient, Food.id == Nutrient.food_id)
            .outerjoin(uses, uses.c.food_id == Food.id)
            .order_by(Food.name.asc())
            .offset(offset).limit(limit)
        )
        count_stmt = select(func.count()).select_from(Food)

    result = await db.execute(stmt)
    rows = result.all()
    total = (await db.execute(count_stmt)).scalar() or 0

    items = [
        {"id": str(r.id), "name": r.name, "barcode": r.barcode, "source": r.source, "kcal": r.kcal, "protein": r.protein,
         "serving_size_g": r.serving_size_g, "serving_label": r.serving_label, "uses": r.uses}
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
                    "serving_size_g": off_item.get("serving_size_g"),
                    "serving_label": off_item.get("serving_label"),
                    "uses": 0,
                })

    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


@router.get("/foods/recent")
async def dashboard_recent_foods(
    limit: int = Query(12, ge=1, le=50),
    meal: str | None = Query(None, pattern="^(breakfast|lunch|dinner|snack)$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    """Foods this user logged lately, with the amount they used last time, so the Log food dialog
    can offer them before any typing. With `meal`, what is usually eaten at that meal comes first
    (oats at breakfast, not last night's pasta), then the newest."""
    ranked = (
        select(
            FoodLog.food_id,
            FoodLog.quantity_g,
            FoodLog.amount,
            FoodLog.unit,
            FoodLog.unit_label,
            FoodLog.meal_type,
            FoodLog.logged_at,
            func.row_number().over(partition_by=FoodLog.food_id, order_by=FoodLog.logged_at.desc()).label("rn"),
            func.count().over(partition_by=FoodLog.food_id).label("uses"),
            func.sum(case((FoodLog.meal_type == meal, 1), else_=0)).over(partition_by=FoodLog.food_id).label("meal_uses"),
        )
        .where(FoodLog.user_id == user.id)
        .subquery()
    )
    stmt = (
        select(
            ranked.c.food_id, ranked.c.quantity_g, ranked.c.amount, ranked.c.unit, ranked.c.unit_label, ranked.c.meal_type, ranked.c.uses,
            Food.name, Food.serving_size_g, Food.serving_label, Nutrient.kcal, Nutrient.protein,
        )
        .join(Food, Food.id == ranked.c.food_id)
        .outerjoin(Nutrient, Nutrient.food_id == Food.id)
        .where(ranked.c.rn == 1)
        .order_by(*((ranked.c.meal_uses.desc(),) if meal else ()), ranked.c.logged_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [
        {
            "id": str(r.food_id),
            "name": r.name,
            "kcal": r.kcal,
            "protein": r.protein,
            "serving_size_g": r.serving_size_g,
            "serving_label": r.serving_label,
            "uses": r.uses,
            "last_quantity_g": r.quantity_g,
            # Older logs have no unit: they were grams.
            "last_amount": r.amount if r.amount is not None else r.quantity_g,
            "last_unit": r.unit or "g",
            "last_unit_label": r.unit_label,
            "last_meal_type": r.meal_type,
        }
        for r in rows
    ]


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
    servings = await food_service.user_servings(db, user.id, food.id)
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
        servings=[ServingResponse.model_validate(sv) for sv in servings],
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
