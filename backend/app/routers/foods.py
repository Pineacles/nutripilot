from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_api_key, get_current_user_jwt_or_api_key
from app.database import get_db
from app.models.user import User
from app.schemas.food import FoodCreate, FoodResponse, FoodSearchResult, NutrientData
from app.services import barcode_service, food_service

router = APIRouter(prefix="/api/foods", tags=["foods"])


def _food_to_response(food) -> FoodResponse:
    nutrients = None
    if food.nutrients:
        nutrients = NutrientData.model_validate(food.nutrients, from_attributes=True)
    return FoodResponse(
        id=food.id,
        name=food.name,
        barcode=food.barcode,
        source=food.source,
        nutrients=nutrients,
    )


@router.get("/search", response_model=list[FoodSearchResult])
async def search_foods(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    results = await food_service.search_foods(db, q, limit)
    return results


@router.get("/barcode/{code}", response_model=FoodResponse)
async def get_by_barcode(
    code: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_jwt_or_api_key),
):
    food = await barcode_service.lookup_barcode(db, code)
    if food is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food not found for barcode")
    return _food_to_response(food)


@router.post("", response_model=FoodResponse, status_code=status.HTTP_201_CREATED)
async def create_food(
    body: FoodCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    food = await food_service.create_food(db, body)
    return _food_to_response(food)
