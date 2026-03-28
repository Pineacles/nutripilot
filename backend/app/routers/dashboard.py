from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_jwt
from app.database import get_db
from app.models.user import User
from app.models.weight_log import WeightLog
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
