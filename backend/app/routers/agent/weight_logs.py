from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_jwt_or_api_key
from app.database import get_db
from app.models.user import User
from app.models.weight_log import WeightLog
from app.schemas.weight_log import WeightLogCreate, WeightLogResponse, WeightLogUpdate
from app.services import logging_service
from app.services.clock import today_for

router = APIRouter()


@router.get(
    "/log/weight",
    response_model=list[WeightLogResponse],
    summary="List weight logs",
    description=(
        "Retrieve weight and body composition entries. Optionally filter by source (e.g. `manual`, `withings`, `garmin`) "
        "and/or date range.\n\n"
        "Returns entries sorted by date ascending."
    ),
)
async def list_weight_logs(
    source: str | None = Query(None, max_length=50),
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    stmt = select(WeightLog).where(WeightLog.user_id == user.id)
    if source:
        stmt = stmt.where(WeightLog.source == source)
    if from_date:
        stmt = stmt.where(WeightLog.date >= from_date)
    if to_date:
        stmt = stmt.where(WeightLog.date <= to_date)
    stmt = stmt.order_by(WeightLog.date.asc(), WeightLog.logged_at.asc())
    result = await db.execute(stmt)
    return [WeightLogResponse.model_validate(w) for w in result.scalars().all()]


@router.post(
    "/log/weight",
    response_model=WeightLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log weight and body composition",
    description=(
        "Record a weight measurement with optional body composition data.\n\n"
        "**Fields:** `weight_kg` (required), `body_fat_pct`, `muscle_mass_pct`, "
        "`body_fat_kg`, `muscle_mass_kg`, `source` (e.g. 'manual', 'withings'), `date`.\n\n"
        "The summary endpoints will automatically average multiple entries on the same day "
        "and derive missing values (e.g. body_fat_kg from body_fat_pct × weight_kg)."
    ),
)
async def log_weight(
    body: WeightLogCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    entry = await logging_service.log_weight(
        db, user.id, body.weight_kg, body.body_fat_pct, body.muscle_mass_pct,
        body.body_fat_kg, body.muscle_mass_kg, body.source or "manual", body.date or today_for(user)
    )
    return WeightLogResponse(
        id=entry.id,
        weight_kg=entry.weight_kg,
        body_fat_pct=entry.body_fat_pct,
        muscle_mass_pct=entry.muscle_mass_pct,
        body_fat_kg=entry.body_fat_kg,
        muscle_mass_kg=entry.muscle_mass_kg,
        source=entry.source,
        date=entry.date,
    )


@router.put(
    "/log/weight/{log_id}",
    response_model=WeightLogResponse,
    summary="Update a weight log entry",
    description="Change weight, body fat, or muscle mass on an existing weight log. Only send the fields you want to change.",
)
async def update_weight_log(
    log_id: UUID,
    body: WeightLogUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(select(WeightLog).where(WeightLog.id == log_id, WeightLog.user_id == user.id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail={"code": "LOG_NOT_FOUND"})
    updates = body.model_dump(exclude_unset=True)
    new_date = updates.pop("log_date", None)
    if new_date is not None:
        if log.source != "manual":
            raise HTTPException(
                status_code=422,
                detail={"code": "SYNCED_LOG_DATE_IMMUTABLE", "detail": "date of synced entries cannot be changed"},
            )
        log.date = new_date
    for field, value in updates.items():
        setattr(log, field, value)
    await db.commit()
    await db.refresh(log)
    return WeightLogResponse(
        id=log.id,
        weight_kg=log.weight_kg,
        body_fat_pct=log.body_fat_pct,
        muscle_mass_pct=log.muscle_mass_pct,
        body_fat_kg=log.body_fat_kg,
        muscle_mass_kg=log.muscle_mass_kg,
        source=log.source,
        date=log.date,
    )


@router.delete(
    "/log/weight/{log_id}",
    status_code=204,
    summary="Delete a weight log entry",
    description="Permanently remove a weight log entry.",
)
async def delete_weight_log(
    log_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(select(WeightLog).where(WeightLog.id == log_id, WeightLog.user_id == user.id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail={"code": "LOG_NOT_FOUND"})
    await db.delete(log)
    await db.commit()
