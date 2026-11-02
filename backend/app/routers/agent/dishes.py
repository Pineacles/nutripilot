from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_jwt_or_api_key
from app.database import get_db
from app.models.user import User
from app.schemas.dish import DishCreate, DishResponse, DishUpdate
from app.services import dish_service

router = APIRouter()


@router.post(
    "/dishes",
    response_model=DishResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Build a dish from component foods",
    description=(
        "Create a complete meal from parts, e.g. a plate of rice, chicken and broccoli. "
        "The dish is a food (`source` `dish`): it shows up in food search and is logged with "
        "`POST /api/agent/log/food` (`servings=1` is one portion).\n\n"
        "**Body:** `name`, `components` (1-30 items of `{food_id, quantity_g}`, grams as eaten or cooked, "
        "matching the component's own per-100 g values), `portion_g` (optional, grams of one portion; "
        "default is the sum of the component grams), `private` (default true: only you can see it).\n\n"
        "**The server computes** the dish's per-100 g nutrients for every nutrient from the components "
        "and sets `serving_size_g` to the portion and `serving_label` to `1 portion`. Create missing "
        "components first with `POST /api/foods` (use `source` `ai_estimate` for your own estimates).\n\n"
        "**Errors:** `404 FOOD_NOT_FOUND` (with `food_id`) if a component doesn't exist or is another user's "
        "private food; `422 PRIVATE_COMPONENT` if `private` is false but a component is private."
    ),
)
async def create_dish(
    body: DishCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    dish = await dish_service.create_dish(db, user.id, body.name, body.components, body.portion_g, body.private)
    return await dish_service.dish_response(db, dish)


@router.get(
    "/dishes/{dish_id}",
    response_model=DishResponse,
    summary="Get a dish with its components",
    description=(
        "Returns the dish with per-100 g `nutrients`, the portion size, `kcal_per_portion`, and each component's "
        "`name`, `quantity_g` (grams) and `kcal` for that quantity.\n\n"
        "**Errors:** `404 DISH_NOT_FOUND` if the id is not one of your dishes."
    ),
)
async def get_dish(
    dish_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    dish = await dish_service.get_own_dish(db, user.id, dish_id)
    return await dish_service.dish_response(db, dish)


@router.put(
    "/dishes/{dish_id}",
    response_model=DishResponse,
    summary="Replace a dish's components",
    description=(
        "Replace all components of a dish you own and recompute its nutrients. `components` is required (1-30 items); "
        "`name`, `private` and `portion_g` are optional (name and privacy stay as they were when omitted; "
        "an omitted `portion_g` becomes the sum of the component grams). Past food logs keep their amounts "
        "but show the new values, like any food edit.\n\n"
        "Also use this to refresh a dish after one of its component foods was corrected.\n\n"
        "**Errors:** `404 DISH_NOT_FOUND`; `404 FOOD_NOT_FOUND` for a missing or private-to-others component; "
        "`422 PRIVATE_COMPONENT` for a public dish with a private component."
    ),
)
async def update_dish(
    dish_id: UUID,
    body: DishUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    dish = await dish_service.get_own_dish(db, user.id, dish_id)
    dish = await dish_service.update_dish(db, user.id, dish, body.name, body.components, body.portion_g, body.private)
    return await dish_service.dish_response(db, dish)
