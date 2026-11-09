from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_jwt_or_api_key
from app.database import get_db
from app.models.user import User
from app.schemas.review import WeekReview
from app.services import review_service

router = APIRouter()


@router.get(
    "/review/week",
    response_model=WeekReview,
    summary="Weekly review: logging, intake against targets, weight trend",
    description=(
        "Facts for a weekly check-in, for the 7 days ending `end_date` (default: yesterday, the last "
        "finished day). Read only.\n\n"
        "- **days**: each day's kcal, protein, fiber, weigh-in, and whether it was logged, in the calorie "
        "window and met protein and fiber\n"
        "- **intake**: logged and fully logged days, averages over fully logged days, weekday vs weekend kcal, "
        "days in the window and days meeting protein and fiber\n"
        "- **previous_week**: logged days and averages of the week before, for comparison\n"
        "- **weight**: smoothed trend at the start and end of the week, weekly rate (14-day span)\n"
        "- **micronutrient_gaps**: tracked micronutrients averaging under 70 % of their target\n"
        "- **flags**: measured facts worth a sentence (`logging_gaps`, `light_days`, `under_safe_floor`, "
        "`protein_low`, `fiber_low`, `weekend_higher`, `loss_too_fast`, `trend_not_falling`, "
        "`micronutrient_low`, `nutrient_data_thin`). Fiber and micronutrients are only judged when foods with a value "
        "make up 70 % of the logged kcal. They describe the week, never the person: talk about logging and trends, "
        "and on `under_safe_floor` or `loss_too_fast` never suggest eating less."
    ),
)
async def review_week(
    end_date: date | None = Query(None, description="Last day of the 7-day window (default: yesterday)"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    return await review_service.get_week_review(db, user, end_date)
