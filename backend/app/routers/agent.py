from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_api_key
from app.database import get_db
from app.models.micronutrient_target import MicronutrientTarget
from app.models.supplement_definition import SupplementDefinition
from app.models.user import User
from app.schemas.food_log import FoodLogByBarcodeCreate, FoodLogCreate, FoodLogResponse
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
from app.schemas.supplement import SupplementCreate, SupplementResponse
from app.schemas.summary import TodaySummary, WeekSummary
from app.schemas.weight_log import WeightLogCreate, WeightLogResponse
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food not found")

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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food not found for barcode")

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
        db, user.id, body.weight_kg, body.body_fat_pct, body.muscle_mass_pct, "manual", body.date
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
