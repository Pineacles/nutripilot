from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_jwt_or_api_key
from app.database import get_db
from app.models.user import User
from app.schemas.profile import ProfileResponse, ProfileUpdate

router = APIRouter()


@router.get(
    "/profile",
    response_model=ProfileResponse,
    summary="Get the body profile",
    description=(
        "Returns the body profile (`height_cm`, `birth_year`, `sex`, `activity_level`; each null until set) "
        "plus the current targets (`target_kcal`, `target_protein_g`, `target_weight_kg`, `target_body_fat_pct`) "
        "and the user's `timezone`.\n\n"
        "**Use this before coaching:** `GET /progress` can only work out BMR and maintenance calories when "
        "height, birth year, sex and activity level are set."
    ),
)
async def get_profile(user: User = Depends(get_current_user_jwt_or_api_key)):
    return ProfileResponse.model_validate(user)


@router.put(
    "/profile",
    response_model=ProfileResponse,
    summary="Update the body profile",
    description=(
        "Partial update: send only the fields to change (send `null` to clear one). Targets are changed "
        "with `PUT /settings/nutrition-targets`, not here.\n\n"
        "**Fields:** `height_cm` (100-250), `birth_year` (1900 to this year minus 10), "
        "`sex` (`female` or `male`, used for the Mifflin-St Jeor BMR), "
        "`activity_level` (`sedentary`, `light`, `moderate`, `active`, `very_active`).\n\n"
        "**Errors:** `422` for a value outside these ranges or lists."
    ),
)
async def update_profile(
    body: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return ProfileResponse.model_validate(user)
