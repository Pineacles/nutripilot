from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_jwt_or_api_key
from app.database import get_db
from app.models.user import User
from app.schemas.summary import StatsSummary, TodaySummary, WeekSummary
from app.services import summary_service
from app.services.clock import today_for
from app.services.nutrient_sources import get_nutrient_sources

router = APIRouter()


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
    target_from = from_date or today_for(user)
    target_to = to_date or today_for(user)
    return await get_nutrient_sources(db, user, nutrient, target_from, target_to)
