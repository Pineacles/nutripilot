"""Shared settings logic used by both the user-facing settings router
(app/routers/settings.py, JWT auth, prefix /api/v1) and the agent settings
mirror (app/routers/agent/settings_mirror.py, JWT-or-API-key auth, prefix
/api/agent).

Both routers are thin wrappers around these functions; they differ only in
auth dependency and route prefix/docs. Keep behavior identical between the
two surfaces.
"""

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.micronutrient_target import MicronutrientTarget
from app.models.supplement_definition import SupplementDefinition
from app.models.user import User
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


async def get_settings(db: AsyncSession, user: User) -> UserSettingsResponse:
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
            target_alcohol_g=user.target_alcohol_g,
            target_water_ml=user.target_water_ml,
            target_caffeine_mg=user.target_caffeine_mg,
            target_weight_kg=user.target_weight_kg,
            target_body_fat_pct=user.target_body_fat_pct,
            timezone=user.timezone,
        ),
        micronutrient_targets=micro_targets,
        supplement_definitions=[SupplementDefinitionResponse.model_validate(s) for s in supps],
        api_key_masked=f"...{user.api_key[-6:]}",
    )


async def update_nutrition_targets(
    db: AsyncSession, user: User, body: NutritionTargetsUpdate
) -> NutritionTargetsResponse:
    user.target_kcal = body.target_kcal
    user.target_protein_g = body.target_protein_g
    user.target_carbs_g = body.target_carbs_g
    user.target_fat_g = body.target_fat_g
    user.target_fiber_g = body.target_fiber_g
    user.target_sugar_g = body.target_sugar_g
    user.target_sodium_mg = body.target_sodium_mg
    user.target_alcohol_g = body.target_alcohol_g
    user.target_water_ml = body.target_water_ml
    user.target_caffeine_mg = body.target_caffeine_mg
    user.target_weight_kg = body.target_weight_kg
    user.target_body_fat_pct = body.target_body_fat_pct
    if body.timezone is not None:
        user.timezone = body.timezone
    await db.commit()
    return NutritionTargetsResponse(
        target_kcal=user.target_kcal,
        target_protein_g=user.target_protein_g,
        target_carbs_g=user.target_carbs_g,
        target_fat_g=user.target_fat_g,
        target_fiber_g=user.target_fiber_g,
        target_sugar_g=user.target_sugar_g,
        target_sodium_mg=user.target_sodium_mg,
        target_alcohol_g=user.target_alcohol_g,
        target_water_ml=user.target_water_ml,
        target_caffeine_mg=user.target_caffeine_mg,
        target_weight_kg=user.target_weight_kg,
        target_body_fat_pct=user.target_body_fat_pct,
        timezone=user.timezone,
    )


async def update_micronutrient_targets(
    db: AsyncSession, user: User, body: MicronutrientTargetsUpdate
) -> list[MicronutrientTargetItem]:
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


async def list_supplement_definitions(
    db: AsyncSession, user: User
) -> list[SupplementDefinitionResponse]:
    result = await db.execute(
        select(SupplementDefinition).where(SupplementDefinition.user_id == user.id)
    )
    return [SupplementDefinitionResponse.model_validate(s) for s in result.scalars().all()]


async def create_supplement_definition(
    db: AsyncSession, user: User, body: SupplementDefinitionCreate
) -> SupplementDefinitionResponse:
    supp = SupplementDefinition(
        user_id=user.id, name=body.name, dose_amount=body.dose_amount,
        dose_unit=body.dose_unit, time_of_day=body.time_of_day, micronutrients=body.micronutrients,
    )
    db.add(supp)
    await db.commit()
    await db.refresh(supp)
    return SupplementDefinitionResponse.model_validate(supp)


async def update_supplement_definition(
    db: AsyncSession, user: User, supp_id: UUID, body: SupplementDefinitionUpdate
) -> SupplementDefinitionResponse:
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


async def delete_supplement_definition(db: AsyncSession, user: User, supp_id: UUID) -> None:
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
