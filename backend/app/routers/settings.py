from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.api_keys import PREFIX_LENGTH, hash_api_key, mask_api_key, new_api_key
from app.auth.dependencies import get_current_user_jwt
from app.database import get_db
from app.models.integration import Integration
from app.models.user import User
from app.schemas.game import GameSettingsResponse, GameSettingsUpdate
from app.schemas.integration import IntegrationResponse
from app.schemas.settings import (
    ApiKeyResponse,
    MicronutrientTargetItem,
    MicronutrientTargetsUpdate,
    NutritionTargetsResponse,
    NutritionTargetsUpdate,
    SupplementDefinitionCreate,
    SupplementDefinitionResponse,
    SupplementDefinitionUpdate,
    TrackedNutrientsUpdate,
    UserSettingsResponse,
)
from app.services import game_service, settings_service

router = APIRouter(prefix="/api/v1", tags=["settings"])


# --- GET all settings ---

@router.get("/settings", response_model=UserSettingsResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    return await settings_service.get_settings(db, user)


# --- Nutrition targets ---

@router.put("/settings/nutrition-targets", response_model=NutritionTargetsResponse)
async def update_nutrition_targets(
    body: NutritionTargetsUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    return await settings_service.update_nutrition_targets(db, user, body)


# --- Tracked nutrients (which ones the dashboard shows) ---

@router.put("/settings/tracked-nutrients", response_model=TrackedNutrientsUpdate)
async def update_tracked_nutrients(
    body: TrackedNutrientsUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    return TrackedNutrientsUpdate(hidden=await settings_service.update_tracked_nutrients(db, user, body.hidden))


# --- Game features (streak, prints, quests) ---

@router.put("/settings/game", response_model=GameSettingsResponse)
async def update_game_settings(
    body: GameSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    return await game_service.update_game_settings(db, user, body)


# --- Micronutrient targets ---

@router.put("/settings/micronutrient-targets", response_model=list[MicronutrientTargetItem])
async def update_micronutrient_targets(
    body: MicronutrientTargetsUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    return await settings_service.update_micronutrient_targets(db, user, body)


# --- Supplement definitions CRUD ---

@router.get("/supplements", response_model=list[SupplementDefinitionResponse])
async def list_supplements(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    return await settings_service.list_supplement_definitions(db, user)


@router.post("/supplements", response_model=SupplementDefinitionResponse, status_code=status.HTTP_201_CREATED)
async def create_supplement(
    body: SupplementDefinitionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    return await settings_service.create_supplement_definition(db, user, body)


@router.put("/supplements/{supp_id}", response_model=SupplementDefinitionResponse)
async def update_supplement(
    supp_id: UUID,
    body: SupplementDefinitionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    return await settings_service.update_supplement_definition(db, user, supp_id, body)


@router.delete("/supplements/{supp_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_supplement(
    supp_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    await settings_service.delete_supplement_definition(db, user, supp_id)


# --- API key regeneration ---

@router.post("/settings/regenerate-api-key", response_model=ApiKeyResponse)
async def regenerate_api_key(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    new_key = new_api_key()
    user.api_key_hash = hash_api_key(new_key)
    user.api_key_prefix = new_key[:PREFIX_LENGTH]
    await db.commit()
    return ApiKeyResponse(
        api_key_masked=mask_api_key(user.api_key_prefix),
        api_key=new_key,
    )


# --- Connected Integrations (read-only for user) ---

@router.get("/integrations", response_model=list[IntegrationResponse])
async def list_integrations(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt),
):
    result = await db.execute(
        select(Integration).where(Integration.user_id == user.id).order_by(Integration.created_at.desc())
    )
    return [IntegrationResponse.model_validate(i) for i in result.scalars().all()]
