from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_jwt
from app.database import get_db
from app.models.food import Food
from app.models.food_log import FoodLog
from app.models.nutrient import Nutrient
from app.models.supplement import Supplement
from app.models.supplement_definition import SupplementDefinition
from app.models.user import User
from app.models.weight_log import WeightLog
from app.schemas.food import FoodResponse, FoodSearchResult, NutrientData
from app.schemas.summary import StatsSummary, TodaySummary, WeekSummary
from app.services import food_service, summary_service

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
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    from datetime import date, timedelta
    if mode == "week":
        today = date.today()
        # Monday of current week
        monday = today - timedelta(days=today.weekday())
        sunday = monday + timedelta(days=6)
        return await summary_service.get_week_summary(db, user, end_date=sunday, start_override=monday)
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
    return FoodResponse(id=food.id, name=food.name, barcode=food.barcode, source=food.source, nutrients=nutrients)


@router.get("/nutrient-sources")
async def nutrient_sources(
    nutrient: str = Query(..., description="Nutrient field name, e.g. 'zinc', 'protein', 'vit_d'"),
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    """Get foods that contributed to a specific nutrient, ranked by amount."""
    from sqlalchemy.orm import joinedload

    target_from = from_date or date.today()
    target_to = to_date or date.today()

    stmt = (
        select(FoodLog)
        .where(FoodLog.user_id == user.id, FoodLog.date >= target_from, FoodLog.date <= target_to)
        .options(joinedload(FoodLog.food).joinedload(Food.nutrients))
    )
    result = await db.execute(stmt)
    logs = result.unique().scalars().all()

    # Handle special cases: sodium comes from salt * 400
    is_sodium = nutrient == "sodium"

    sources = []
    for log in logs:
        n = log.food.nutrients
        if not n:
            continue
        ratio = log.quantity_g / 100.0

        if is_sodium:
            raw_val = (n.salt or 0) * 400
        else:
            raw_val = getattr(n, nutrient, None)
            if raw_val is None:
                continue

        amount = round(raw_val * ratio, 2)
        if amount <= 0:
            continue

        sources.append({
            "food_name": log.food.name,
            "quantity_g": log.quantity_g,
            "amount": amount,
            "date": str(log.date),
            "meal_type": log.meal_type,
        })

    # Sort by contribution descending
    sources.sort(key=lambda x: x["amount"], reverse=True)

    # Also add supplement contributions if it's a micro
    SUPP_MICRO_MAP = {
        "vit_d": "vitamin_d", "zinc": "zinc", "omega3": "omega3",
        "iron": "iron", "calcium": "calcium", "magnesium": "magnesium",
        "b12": "b12", "vit_c": "vit_c", "potassium": "potassium",
    }
    supp_key = SUPP_MICRO_MAP.get(nutrient)
    # Also check reverse: definitions might store keys as "vit_d" or "vitamin_d"
    supp_key_aliases = {nutrient, supp_key} if supp_key else {nutrient}
    # Build reverse map too (vitamin_d → vit_d)
    reverse_map = {v: k for k, v in SUPP_MICRO_MAP.items()}
    if nutrient in reverse_map:
        supp_key_aliases.add(reverse_map[nutrient])
    supp_key_aliases.discard(None)

    supp_sources = []
    if supp_key_aliases:
        defs_result = await db.execute(select(SupplementDefinition).where(SupplementDefinition.user_id == user.id))
        defs = {d.name.lower(): d for d in defs_result.scalars().all()}

        supp_result = await db.execute(
            select(Supplement).where(Supplement.user_id == user.id, Supplement.date >= target_from, Supplement.date <= target_to)
        )
        for s in supp_result.scalars().all():
            defn = defs.get(s.name.lower())
            if not defn or not defn.micronutrients:
                continue
            # Check all possible key aliases
            for alias in supp_key_aliases:
                if alias in defn.micronutrients:
                    val = defn.micronutrients[alias]
                    if isinstance(val, (int, float)) and val > 0:
                        supp_sources.append({
                            "food_name": f"{s.name} (supplement)",
                            "quantity_g": s.dose_amount,
                            "amount": round(val, 2),
                            "date": str(s.date),
                            "meal_type": "supplement",
                        })
                    break  # found a match, don't double-count

    all_sources = sources + supp_sources
    all_sources.sort(key=lambda x: x["amount"], reverse=True)

    total = round(sum(s["amount"] for s in all_sources), 2)

    return {
        "nutrient": nutrient,
        "from_date": str(target_from),
        "to_date": str(target_to),
        "total": total,
        "sources": all_sources[:30],
    }
