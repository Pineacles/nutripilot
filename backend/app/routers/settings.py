import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_jwt
from app.database import get_db
from app.models.micronutrient_target import MicronutrientTarget
from app.models.supplement_definition import SupplementDefinition
from app.models.user import User
from app.schemas.settings import (
    ApiKeyResponse,
    MicronutrientTargetItem,
    MicronutrientTargetsUpdate,
    NutritionTargetsResponse,
    NutritionTargetsUpdate,
    SupplementDefinitionCreate,
    SupplementDefinitionResponse,
    SupplementDefinitionUpdate,
    UserSettingsResponse,
)

router = APIRouter(prefix="/api/v1", tags=["settings"])


# --- GET all settings ---

@router.get("/settings", response_model=UserSettingsResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    # Micronutrient targets
    result = await db.execute(
        select(MicronutrientTarget).where(MicronutrientTarget.user_id == user.id)
    )
    micro_targets = [
        MicronutrientTargetItem(nutrient=t.nutrient, target_value=t.target_value, unit=t.unit)
        for t in result.scalars().all()
    ]

    # Supplement definitions
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


# --- Nutrition targets ---

@router.put("/settings/nutrition-targets", response_model=NutritionTargetsResponse)
async def update_nutrition_targets(
    body: NutritionTargetsUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
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


# --- Micronutrient targets ---

@router.put("/settings/micronutrient-targets", response_model=list[MicronutrientTargetItem])
async def update_micronutrient_targets(
    body: MicronutrientTargetsUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    # Delete existing and re-insert
    await db.execute(
        delete(MicronutrientTarget).where(MicronutrientTarget.user_id == user.id)
    )
    new_targets = []
    for t in body.targets:
        mt = MicronutrientTarget(
            user_id=user.id,
            nutrient=t.nutrient,
            target_value=t.target_value,
            unit=t.unit,
        )
        db.add(mt)
        new_targets.append(t)
    await db.commit()
    return new_targets


# --- Supplement definitions CRUD ---

@router.get("/supplements", response_model=list[SupplementDefinitionResponse])
async def list_supplements(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    result = await db.execute(
        select(SupplementDefinition).where(SupplementDefinition.user_id == user.id)
    )
    return [SupplementDefinitionResponse.model_validate(s) for s in result.scalars().all()]


@router.post("/supplements", response_model=SupplementDefinitionResponse, status_code=status.HTTP_201_CREATED)
async def create_supplement(
    body: SupplementDefinitionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    supp = SupplementDefinition(
        user_id=user.id,
        name=body.name,
        dose_amount=body.dose_amount,
        dose_unit=body.dose_unit,
        time_of_day=body.time_of_day,
        micronutrients=body.micronutrients,
    )
    db.add(supp)
    await db.commit()
    await db.refresh(supp)
    return SupplementDefinitionResponse.model_validate(supp)


@router.put("/supplements/{supp_id}", response_model=SupplementDefinitionResponse)
async def update_supplement(
    supp_id: UUID,
    body: SupplementDefinitionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    result = await db.execute(
        select(SupplementDefinition).where(
            SupplementDefinition.id == supp_id,
            SupplementDefinition.user_id == user.id,
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
async def delete_supplement(
    supp_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    result = await db.execute(
        select(SupplementDefinition).where(
            SupplementDefinition.id == supp_id,
            SupplementDefinition.user_id == user.id,
        )
    )
    supp = result.scalar_one_or_none()
    if supp is None:
        raise HTTPException(status_code=404, detail="Supplement not found")
    await db.delete(supp)
    await db.commit()


# --- API key regeneration ---

@router.post("/settings/regenerate-api-key", response_model=ApiKeyResponse)
async def regenerate_api_key(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    new_key = secrets.token_hex(32)
    user.api_key = new_key
    await db.commit()
    return ApiKeyResponse(
        api_key_masked=f"...{new_key[-6:]}",
        api_key=new_key,
    )
