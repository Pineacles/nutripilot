from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_jwt_or_api_key
from app.database import get_db
from app.models.supplement import Supplement
from app.models.user import User
from app.schemas.settings import (
    SupplementDefinitionCreate,
    SupplementDefinitionResponse,
    SupplementDefinitionUpdate,
)
from app.schemas.supplement import SupplementCreate, SupplementLogUpdate, SupplementResponse
from app.services import logging_service, settings_service
from app.services.clock import today_for

router = APIRouter()


# --- Supplement Logging ---

@router.post(
    "/log/supplement",
    response_model=SupplementResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log supplement intake",
    description=(
        "Record that the user took a supplement. Provide name, dose, unit, and optionally time of day.\n\n"
        "**Units:** `mg`, `g`, `IU`, `mcg`, `µg`, `ml`.\n\n"
        "**Time of day:** `morning`, `afternoon`, `evening` (optional).\n\n"
        "If the supplement has a matching definition (by name), its micronutrient content "
        "will be automatically included in daily micronutrient totals and nutrient-source queries."
    ),
)
async def log_supplement(
    body: SupplementCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    entry = await logging_service.log_supplement(
        db, user.id, body.name, body.dose_amount, body.dose_unit, body.time_of_day, body.date or today_for(user)
    )
    return SupplementResponse(
        id=entry.id,
        name=entry.name,
        dose_amount=entry.dose_amount,
        dose_unit=entry.dose_unit,
        time_of_day=entry.time_of_day,
        date=entry.date,
    )


@router.get(
    "/log/supplement",
    response_model=list[SupplementResponse],
    summary="List supplement logs for a day",
    description="Get all supplement log entries for a specific date (default: today).",
)
async def list_supplement_logs(
    day: date | None = Query(None, description="Date to get logs for (default: today)"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    target_date = day or today_for(user)
    result = await db.execute(
        select(Supplement)
        .where(Supplement.user_id == user.id, Supplement.date == target_date)
        .order_by(Supplement.logged_at.asc())
    )
    return [
        SupplementResponse(
            id=s.id, name=s.name, dose_amount=s.dose_amount, dose_unit=s.dose_unit,
            time_of_day=s.time_of_day, date=s.date,
        )
        for s in result.scalars().all()
    ]


@router.put(
    "/log/supplement/{log_id}",
    response_model=SupplementResponse,
    summary="Update a supplement log entry",
    description="Change name, dose, unit, time of day, or date on an existing supplement log.",
)
async def update_supplement_log(
    log_id: UUID,
    body: SupplementLogUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(select(Supplement).where(Supplement.id == log_id, Supplement.user_id == user.id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail={"code": "LOG_NOT_FOUND"})
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(log, field, value)
    await db.commit()
    await db.refresh(log)
    return SupplementResponse(
        id=log.id,
        name=log.name,
        dose_amount=log.dose_amount,
        dose_unit=log.dose_unit,
        time_of_day=log.time_of_day,
        date=log.date,
    )


@router.delete(
    "/log/supplement/{log_id}",
    status_code=204,
    summary="Delete a supplement log entry",
    description="Permanently remove a supplement log entry.",
)
async def delete_supplement_log(
    log_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    result = await db.execute(select(Supplement).where(Supplement.id == log_id, Supplement.user_id == user.id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail={"code": "LOG_NOT_FOUND"})
    await db.delete(log)
    await db.commit()


# --- Supplement Definitions (agent-managed mirror of /api/v1/supplements) ---

@router.get(
    "/supplements",
    response_model=list[SupplementDefinitionResponse],
    summary="List supplement definitions",
    description=(
        "Get all configured supplement definitions. These define what supplements the user takes, "
        "their dose, and which micronutrients they contribute.\n\n"
        "Supplement definitions are separate from supplement logs: "
        "definitions describe *what* the user takes, logs record *when* they took it."
    ),
)
async def agent_list_supplements(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    return await settings_service.list_supplement_definitions(db, user)


@router.post(
    "/supplements",
    response_model=SupplementDefinitionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create supplement definition",
    description=(
        "Define a new supplement the user takes regularly.\n\n"
        "**micronutrients** (optional dict) maps nutrient keys to amounts per dose. "
        "Use these keys: `vitamin_d`, `zinc`, `omega3`, `iron`, `calcium`, `magnesium`, `b12`, `vit_c`, `potassium`.\n\n"
        "Example: `{name: 'Vitamin D3', dose_amount: 4000, dose_unit: 'IU', micronutrients: {vitamin_d: 100}}`\n\n"
        "When the user logs this supplement, its micronutrient content is automatically counted in daily totals."
    ),
)
async def agent_create_supplement(
    body: SupplementDefinitionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    return await settings_service.create_supplement_definition(db, user, body)


@router.put(
    "/supplements/{supp_id}",
    response_model=SupplementDefinitionResponse,
    summary="Update supplement definition",
    description="Update any field on a supplement definition. Only send the fields you want to change.",
)
async def agent_update_supplement(
    supp_id: UUID,
    body: SupplementDefinitionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    return await settings_service.update_supplement_definition(db, user, supp_id, body)


@router.delete(
    "/supplements/{supp_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete supplement definition",
    description="Permanently remove a supplement definition. This does NOT delete past supplement logs.",
)
async def agent_delete_supplement(
    supp_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    await settings_service.delete_supplement_definition(db, user, supp_id)
