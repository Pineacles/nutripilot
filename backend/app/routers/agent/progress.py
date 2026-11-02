from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_jwt_or_api_key
from app.database import get_db
from app.models.user import User
from app.schemas.progress import ProgressResponse
from app.services import progress_service

router = APIRouter()


@router.get(
    "/progress",
    response_model=ProgressResponse,
    summary="Weight trend, intake and calorie estimates for coaching",
    description=(
        "Everything needed to coach weight loss, over the last `days` days (7-120, default 28), ending today.\n\n"
        "- `trend`: one point per day from the first weigh-in: `weight_kg` (the day's average, null on days "
        "without a weigh-in) and `trend_kg`, an exponentially smoothed weight (10 % of the gap per day). "
        "`latest_trend_kg` is the newest value. Coach from the trend, not from single weigh-ins.\n"
        "- `rate_kg_per_week`, `rate_pct_per_week`: change of the trend over the last 14 days "
        "(negative = losing); null with fewer than 2 weigh-ins in that span.\n"
        "- `intake`: `days_logged`, `avg_kcal` and `avg_protein_g` over days that have food logs only.\n"
        "- `tdee_estimate_kcal`: average intake minus the energy the trend change stands for "
        "(7700 kcal per kg); null until 14 logged days and 8 weigh-in days exist. "
        "`tdee_confidence` is `low` (14+ logged days), `medium` (21+) or `high` (26+). Today is still open and never counts as logged.\n"
        "- `bmr_kcal` (Mifflin-St Jeor from the latest trend, height, birth year and sex) and "
        "`maintenance_from_profile` (BMR times the activity factor): null when the profile "
        "(`GET /profile`) or a weigh-in is missing.\n"
        "- `safe_floor_kcal`: never suggest a daily target below this (BMR, at least 1500 for men, 1200 otherwise).\n"
        "- `targets` (kcal, protein g, weight kg) and `protein_per_kg` (protein target over the latest trend).\n\n"
        "**Units:** kg, kcal per day, grams. **Errors:** `422` if `days` is outside 7-120."
    ),
)
async def get_progress(
    days: int = Query(28, ge=7, le=120),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    return await progress_service.get_progress(db, user, days)
