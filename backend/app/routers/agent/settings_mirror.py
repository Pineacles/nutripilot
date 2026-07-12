from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_jwt_or_api_key
from app.database import get_db
from app.models.user import User
from app.schemas.settings import (
    MicronutrientTargetItem,
    MicronutrientTargetsUpdate,
    NutritionTargetsResponse,
    NutritionTargetsUpdate,
    UserSettingsResponse,
)
from app.services import settings_service

router = APIRouter()


@router.get(
    "/settings",
    response_model=UserSettingsResponse,
    summary="Get all user settings",
    description=(
        "Returns the user's complete settings:\n\n"
        "- **nutrition_targets**: daily targets for kcal, protein, carbs, fat, fiber, sugar, sodium, alcohol, water, caffeine\n"
        "- **micronutrient_targets**: custom targets for micros (e.g. calcium 1000mg)\n"
        "- **supplement_definitions**: configured supplements with dose and micronutrient content\n"
        "- **api_key_masked**: last 6 chars of the API key\n\n"
        "**Always GET settings before updating nutrition targets**, so you can send back all fields (PUT replaces the entire object)."
    ),
)
async def agent_get_settings(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    return await settings_service.get_settings(db, user)


@router.put(
    "/settings/nutrition-targets",
    response_model=NutritionTargetsResponse,
    summary="Update nutrition targets",
    description=(
        "Replace all daily nutrition targets. **All fields are required**: GET settings first to preserve unchanged values.\n\n"
        "Fields: `target_kcal` (1-10000), `target_protein_g` (0-1000), `target_carbs_g` (0-1000), "
        "`target_fat_g` (0-500), `target_fiber_g` (0-200, default 30), `target_sugar_g` (0-500, default 50), "
        "`target_sodium_mg` (0-10000, default 2300), `target_alcohol_g` (0-500), "
        "`target_water_ml` (0-20000), `target_caffeine_mg` (0-5000)."
    ),
)
async def agent_update_nutrition_targets(
    body: NutritionTargetsUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    return await settings_service.update_nutrition_targets(db, user, body)


@router.put(
    "/settings/micronutrient-targets",
    response_model=list[MicronutrientTargetItem],
    summary="Replace micronutrient targets",
    description=(
        "Replace ALL micronutrient targets at once (delete + re-insert). "
        "Send the complete list you want: any target not included will be removed.\n\n"
        "Each item: `{nutrient: str, target_value: float (0-100000), unit: str}`.\n\n"
        "Common examples: `{nutrient: 'calcium', target_value: 1000, unit: 'mg'}`, "
        "`{nutrient: 'vit_d', target_value: 50, unit: 'mcg'}`."
    ),
)
async def agent_update_micronutrient_targets(
    body: MicronutrientTargetsUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    return await settings_service.update_micronutrient_targets(db, user, body)
