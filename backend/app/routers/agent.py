from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_api_key
from app.database import get_db
from app.models.food_log import FoodLog
from app.models.integration import Integration
from app.models.micronutrient_target import MicronutrientTarget
from app.models.supplement import Supplement
from app.models.supplement_definition import SupplementDefinition
from app.models.user import User
from app.models.weight_log import WeightLog
from app.schemas.food_log import FoodLogByBarcodeCreate, FoodLogCreate, FoodLogResponse, FoodLogUpdate
from app.schemas.integration import IntegrationCreate, IntegrationResponse, IntegrationUpdate
from app.schemas.settings import (
    MicronutrientTargetItem,
    MicronutrientTargetsUpdate,
    NutritionTargetsResponse,
    NutritionTargetsUpdate,
    SupplementDefinitionCreate,
    SupplementDefinitionResponse,
    SupplementDefinitionUpdate,
    UserSettingsResponse,
)
from app.schemas.supplement import SupplementCreate, SupplementLogUpdate, SupplementResponse
from app.schemas.summary import StatsSummary, TodaySummary, WeekSummary
from app.schemas.weight_log import WeightLogCreate, WeightLogResponse, WeightLogUpdate
from app.services import barcode_service, food_service, logging_service, summary_service

router = APIRouter(prefix="/api/agent", tags=["agent"])


@router.post("/log/food", response_model=FoodLogResponse, status_code=status.HTTP_201_CREATED)
async def log_food(
    body: FoodLogCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    food = await food_service.get_food_by_id(db, body.food_id)
    if food is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Food not found", "code": "FOOD_NOT_FOUND"},
        )

    entry = await logging_service.log_food(db, user.id, food.id, body.quantity_g, body.meal_type, body.date)

    n = food.nutrients
    ratio = body.quantity_g / 100.0
    return FoodLogResponse(
        id=entry.id,
        food_name=food.name,
        quantity_g=entry.quantity_g,
        meal_type=entry.meal_type,
        date=entry.date,
        kcal=round((n.kcal or 0) * ratio, 1) if n else None,
        protein=round((n.protein or 0) * ratio, 1) if n else None,
        carbs=round((n.carbs or 0) * ratio, 1) if n else None,
        fat=round((n.fat or 0) * ratio, 1) if n else None,
    )


@router.post("/log/food-by-barcode", response_model=FoodLogResponse, status_code=status.HTTP_201_CREATED)
async def log_food_by_barcode(
    body: FoodLogByBarcodeCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    food = await barcode_service.lookup_barcode(db, body.barcode)
    if food is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Food not found for barcode", "code": "BARCODE_NOT_FOUND", "barcode": body.barcode},
        )

    entry = await logging_service.log_food(db, user.id, food.id, body.quantity_g, body.meal_type, body.date)

    n = food.nutrients
    ratio = body.quantity_g / 100.0
    return FoodLogResponse(
        id=entry.id,
        food_name=food.name,
        quantity_g=entry.quantity_g,
        meal_type=entry.meal_type,
        date=entry.date,
        kcal=round((n.kcal or 0) * ratio, 1) if n else None,
        protein=round((n.protein or 0) * ratio, 1) if n else None,
        carbs=round((n.carbs or 0) * ratio, 1) if n else None,
        fat=round((n.fat or 0) * ratio, 1) if n else None,
    )


@router.post("/log/supplement", response_model=SupplementResponse, status_code=status.HTTP_201_CREATED)
async def log_supplement(
    body: SupplementCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    entry = await logging_service.log_supplement(
        db, user.id, body.name, body.dose_amount, body.dose_unit, body.time_of_day, body.date
    )
    return SupplementResponse(
        id=entry.id,
        name=entry.name,
        dose_amount=entry.dose_amount,
        dose_unit=entry.dose_unit,
        time_of_day=entry.time_of_day,
        date=entry.date,
    )


@router.post("/log/weight", response_model=WeightLogResponse, status_code=status.HTTP_201_CREATED)
async def log_weight(
    body: WeightLogCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    entry = await logging_service.log_weight(
        db, user.id, body.weight_kg, body.body_fat_pct, body.muscle_mass_pct, body.source or "manual", body.date
    )
    return WeightLogResponse(
        id=entry.id,
        weight_kg=entry.weight_kg,
        body_fat_pct=entry.body_fat_pct,
        muscle_mass_pct=entry.muscle_mass_pct,
        source=entry.source,
        date=entry.date,
    )


@router.get("/summary/today", response_model=TodaySummary)
async def summary_today(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    return await summary_service.get_today_summary(db, user)


@router.get("/summary/week", response_model=WeekSummary)
async def summary_week(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    return await summary_service.get_week_summary(db, user)


# --- Agent Settings ---

@router.get("/settings", response_model=UserSettingsResponse)
async def agent_get_settings(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    result = await db.execute(
        select(MicronutrientTarget).where(MicronutrientTarget.user_id == user.id)
    )
    micro_targets = [
        MicronutrientTargetItem(nutrient=t.nutrient, target_value=t.target_value, unit=t.unit)
        for t in result.scalars().all()
    ]
    result = await db.execute(
        select(SupplementDefinition).where(SupplementDefinition.user_id == user.id)
    )
    supps = result.scalars().all()
    return UserSettingsResponse(
        nutrition_targets=NutritionTargetsResponse(
            target_kcal=user.target_kcal,
            target_protein_g=user.target_protein_g,
            target_carbs_g=user.target_carbs_g,
            target_fat_g=user.target_fat_g,
            target_fiber_g=user.target_fiber_g,
            target_sugar_g=user.target_sugar_g,
            target_sodium_mg=user.target_sodium_mg,
        ),
        micronutrient_targets=micro_targets,
        supplement_definitions=[SupplementDefinitionResponse.model_validate(s) for s in supps],
        api_key_masked=f"...{user.api_key[-6:]}",
    )


@router.put("/settings/nutrition-targets", response_model=NutritionTargetsResponse)
async def agent_update_nutrition_targets(
    body: NutritionTargetsUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    user.target_kcal = body.target_kcal
    user.target_protein_g = body.target_protein_g
    user.target_carbs_g = body.target_carbs_g
    user.target_fat_g = body.target_fat_g
    user.target_fiber_g = body.target_fiber_g
    user.target_sugar_g = body.target_sugar_g
    user.target_sodium_mg = body.target_sodium_mg
    await db.commit()
    return NutritionTargetsResponse(
        target_kcal=user.target_kcal,
        target_protein_g=user.target_protein_g,
        target_carbs_g=user.target_carbs_g,
        target_fat_g=user.target_fat_g,
        target_fiber_g=user.target_fiber_g,
        target_sugar_g=user.target_sugar_g,
        target_sodium_mg=user.target_sodium_mg,
    )


@router.put("/settings/micronutrient-targets", response_model=list[MicronutrientTargetItem])
async def agent_update_micronutrient_targets(
    body: MicronutrientTargetsUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    await db.execute(
        delete(MicronutrientTarget).where(MicronutrientTarget.user_id == user.id)
    )
    new_targets = []
    for t in body.targets:
        mt = MicronutrientTarget(
            user_id=user.id, nutrient=t.nutrient, target_value=t.target_value, unit=t.unit,
        )
        db.add(mt)
        new_targets.append(t)
    await db.commit()
    return new_targets


@router.get("/supplements", response_model=list[SupplementDefinitionResponse])
async def agent_list_supplements(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    result = await db.execute(
        select(SupplementDefinition).where(SupplementDefinition.user_id == user.id)
    )
    return [SupplementDefinitionResponse.model_validate(s) for s in result.scalars().all()]


@router.post("/supplements", response_model=SupplementDefinitionResponse, status_code=status.HTTP_201_CREATED)
async def agent_create_supplement(
    body: SupplementDefinitionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    supp = SupplementDefinition(
        user_id=user.id, name=body.name, dose_amount=body.dose_amount,
        dose_unit=body.dose_unit, time_of_day=body.time_of_day, micronutrients=body.micronutrients,
    )
    db.add(supp)
    await db.commit()
    await db.refresh(supp)
    return SupplementDefinitionResponse.model_validate(supp)


@router.put("/supplements/{supp_id}", response_model=SupplementDefinitionResponse)
async def agent_update_supplement(
    supp_id: UUID,
    body: SupplementDefinitionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    result = await db.execute(
        select(SupplementDefinition).where(
            SupplementDefinition.id == supp_id, SupplementDefinition.user_id == user.id,
        )
    )
    supp = result.scalar_one_or_none()
    if supp is None:
        raise HTTPException(status_code=404, detail="Supplement not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(supp, field, value)
    await db.commit()
    await db.refresh(supp)
    return SupplementDefinitionResponse.model_validate(supp)


@router.delete("/supplements/{supp_id}", status_code=status.HTTP_204_NO_CONTENT)
async def agent_delete_supplement(
    supp_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    result = await db.execute(
        select(SupplementDefinition).where(
            SupplementDefinition.id == supp_id, SupplementDefinition.user_id == user.id,
        )
    )
    supp = result.scalar_one_or_none()
    if supp is None:
        raise HTTPException(status_code=404, detail="Supplement not found")
    await db.delete(supp)
    await db.commit()


# --- Food Log CRUD ---

@router.put("/log/food/{log_id}", response_model=FoodLogResponse)
async def update_food_log(
    log_id: UUID,
    body: FoodLogUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    result = await db.execute(select(FoodLog).where(FoodLog.id == log_id, FoodLog.user_id == user.id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail={"code": "LOG_NOT_FOUND"})
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(log, field, value)
    await db.commit()
    await db.refresh(log)
    food = await food_service.get_food_by_id(db, log.food_id)
    n = food.nutrients if food else None
    ratio = log.quantity_g / 100.0
    return FoodLogResponse(
        id=log.id, food_name=food.name if food else "Unknown",
        quantity_g=log.quantity_g, meal_type=log.meal_type, date=log.date,
        kcal=round((n.kcal or 0) * ratio, 1) if n else None,
        protein=round((n.protein or 0) * ratio, 1) if n else None,
        carbs=round((n.carbs or 0) * ratio, 1) if n else None,
        fat=round((n.fat or 0) * ratio, 1) if n else None,
    )


@router.delete("/log/food/{log_id}", status_code=204)
async def delete_food_log(
    log_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    result = await db.execute(select(FoodLog).where(FoodLog.id == log_id, FoodLog.user_id == user.id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail={"code": "LOG_NOT_FOUND"})
    await db.delete(log)
    await db.commit()


# --- Weight Log CRUD ---

@router.put("/log/weight/{log_id}", response_model=WeightLogResponse)
async def update_weight_log(
    log_id: UUID,
    body: WeightLogUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    result = await db.execute(select(WeightLog).where(WeightLog.id == log_id, WeightLog.user_id == user.id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail={"code": "LOG_NOT_FOUND"})
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(log, field, value)
    await db.commit()
    await db.refresh(log)
    return WeightLogResponse(
        id=log.id,
        weight_kg=log.weight_kg,
        body_fat_pct=log.body_fat_pct,
        muscle_mass_pct=log.muscle_mass_pct,
        source=log.source,
        date=log.date,
    )


@router.delete("/log/weight/{log_id}", status_code=204)
async def delete_weight_log(
    log_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    result = await db.execute(select(WeightLog).where(WeightLog.id == log_id, WeightLog.user_id == user.id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail={"code": "LOG_NOT_FOUND"})
    await db.delete(log)
    await db.commit()


# --- Supplement Log CRUD ---

@router.put("/log/supplement/{log_id}", response_model=SupplementResponse)
async def update_supplement_log(
    log_id: UUID,
    body: SupplementLogUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
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


@router.delete("/log/supplement/{log_id}", status_code=204)
async def delete_supplement_log(
    log_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    result = await db.execute(select(Supplement).where(Supplement.id == log_id, Supplement.user_id == user.id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail={"code": "LOG_NOT_FOUND"})
    await db.delete(log)
    await db.commit()


# --- Stats ---

@router.get("/summary/stats", response_model=StatsSummary)
async def agent_stats(
    days: int = Query(90, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    return await summary_service.get_stats_summary(db, user, days)


# --- Integrations (agent-managed) ---

@router.get("/integrations", response_model=list[IntegrationResponse])
async def agent_list_integrations(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    result = await db.execute(
        select(Integration).where(Integration.user_id == user.id).order_by(Integration.created_at.desc())
    )
    return [IntegrationResponse.model_validate(i) for i in result.scalars().all()]


@router.post("/integrations", response_model=IntegrationResponse, status_code=status.HTTP_201_CREATED)
async def agent_create_integration(
    body: IntegrationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    integration = Integration(
        user_id=user.id,
        name=body.name,
        source_url=body.source_url,
        auth_header=body.auth_header,
        schedule=body.schedule,
        field_mapping=body.field_mapping,
        status="active",
    )
    db.add(integration)
    await db.commit()
    await db.refresh(integration)
    return IntegrationResponse.model_validate(integration)


@router.patch("/integrations/{integration_id}", response_model=IntegrationResponse)
async def agent_update_integration(
    integration_id: UUID,
    body: IntegrationUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    result = await db.execute(
        select(Integration).where(Integration.id == integration_id, Integration.user_id == user.id)
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail={"code": "INTEGRATION_NOT_FOUND"})
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(integration, field, value)
    await db.commit()
    await db.refresh(integration)
    return IntegrationResponse.model_validate(integration)


@router.delete("/integrations/{integration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def agent_delete_integration(
    integration_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    result = await db.execute(
        select(Integration).where(Integration.id == integration_id, Integration.user_id == user.id)
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail={"code": "INTEGRATION_NOT_FOUND"})
    await db.delete(integration)
    await db.commit()
