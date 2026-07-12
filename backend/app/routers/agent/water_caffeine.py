from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_jwt_or_api_key
from app.database import get_db
from app.models.caffeine_log import CaffeineLog
from app.models.user import User
from app.models.water_log import WaterLog
from app.schemas.caffeine_log import CaffeineLogCreate, CaffeineLogResponse, CaffeineLogUpdate
from app.schemas.water_log import WaterLogCreate, WaterLogResponse, WaterLogUpdate
from app.services import logging_service
from app.services.clock import today_for

router = APIRouter()


# --- Water Logging ---

@router.post(
    "/log/water",
    response_model=WaterLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log water intake",
    description="Record water consumption in milliliters. Common: glass = 250ml, bottle = 500ml, large bottle = 1000ml.",
)
async def log_water(
    body: WaterLogCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    entry = await logging_service.log_water(db, user.id, body.amount_ml, body.date or today_for(user))
    return WaterLogResponse.model_validate(entry)


@router.get(
    "/log/water",
    response_model=list[WaterLogResponse],
    summary="List water logs for a day",
    description="Get all water log entries for a specific date (default: today).",
)
async def list_water_logs(
    day: date | None = Query(None, description="Date to get logs for (default: today)"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    target_date = day or today_for(user)
    result = await db.execute(
        select(WaterLog)
        .where(WaterLog.user_id == user.id, WaterLog.date == target_date)
        .order_by(WaterLog.logged_at.asc())
    )
    return [WaterLogResponse.model_validate(w) for w in result.scalars().all()]


@router.put(
    "/log/water/{log_id}",
    response_model=WaterLogResponse,
    summary="Update a water log entry",
    description="Change the amount on an existing water log.",
)
async def update_water_log(
    log_id: UUID,
    body: WaterLogUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(select(WaterLog).where(WaterLog.id == log_id, WaterLog.user_id == user.id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail={"code": "LOG_NOT_FOUND"})
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(log, field, value)
    await db.commit()
    await db.refresh(log)
    return WaterLogResponse.model_validate(log)


@router.delete(
    "/log/water/{log_id}",
    status_code=204,
    summary="Delete a water log entry",
    description="Permanently remove a water log entry.",
)
async def delete_water_log(
    log_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(select(WaterLog).where(WaterLog.id == log_id, WaterLog.user_id == user.id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail={"code": "LOG_NOT_FOUND"})
    await db.delete(log)
    await db.commit()


# --- Caffeine Logging (DEPRECATED) ---

@router.post(
    "/log/caffeine",
    response_model=CaffeineLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="DEPRECATED: Log caffeine intake",
    description=(
        "**DEPRECATED: Caffeine is now tracked automatically through food nutrients.** "
        "Instead of using this endpoint, log a caffeinated food/drink via `POST /log/food-by-name` "
        "(e.g. 'espresso', 'coffee', 'energy drink', 'green tea'). Foods with caffeine data will "
        "automatically count toward the user's daily caffeine total.\n\n"
        "If a food doesn't have caffeine data yet, create it with `POST /api/foods` and include "
        "`caffeine_mg` in the nutrients object (value per 100g)."
    ),
    deprecated=True,
)
async def log_caffeine(
    body: CaffeineLogCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    entry = await logging_service.log_caffeine(db, user.id, body.amount_mg, body.source_name, body.date or today_for(user))
    return CaffeineLogResponse.model_validate(entry)


@router.get(
    "/log/caffeine",
    response_model=list[CaffeineLogResponse],
    summary="List caffeine logs for a day",
    description=(
        "Get all (legacy) caffeine log entries for a specific date (default: today). "
        "Note: caffeine is now tracked automatically through food nutrients; this only "
        "returns entries created via the deprecated `POST /log/caffeine` endpoint."
    ),
)
async def list_caffeine_logs(
    day: date | None = Query(None, description="Date to get logs for (default: today)"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    target_date = day or today_for(user)
    result = await db.execute(
        select(CaffeineLog)
        .where(CaffeineLog.user_id == user.id, CaffeineLog.date == target_date)
        .order_by(CaffeineLog.logged_at.asc())
    )
    return [CaffeineLogResponse.model_validate(c) for c in result.scalars().all()]


@router.put(
    "/log/caffeine/{log_id}",
    response_model=CaffeineLogResponse,
    summary="DEPRECATED: Update a caffeine log entry",
    description="**DEPRECATED.** Caffeine is now tracked through food nutrients. Use food log endpoints instead.",
    deprecated=True,
)
async def update_caffeine_log(
    log_id: UUID,
    body: CaffeineLogUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(select(CaffeineLog).where(CaffeineLog.id == log_id, CaffeineLog.user_id == user.id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail={"code": "LOG_NOT_FOUND"})
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(log, field, value)
    await db.commit()
    await db.refresh(log)
    return CaffeineLogResponse.model_validate(log)


@router.delete(
    "/log/caffeine/{log_id}",
    status_code=204,
    summary="DEPRECATED: Delete a caffeine log entry",
    description="**DEPRECATED.** Caffeine is now tracked through food nutrients. Use food log endpoints instead.",
    deprecated=True,
)
async def delete_caffeine_log(
    log_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(select(CaffeineLog).where(CaffeineLog.id == log_id, CaffeineLog.user_id == user.id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail={"code": "LOG_NOT_FOUND"})
    await db.delete(log)
    await db.commit()
