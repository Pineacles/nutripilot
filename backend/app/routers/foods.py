from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_api_key, get_current_user_jwt_or_api_key
from app.database import get_db
from app.models.food import Food
from app.models.food_log import FoodLog
from app.models.user import User
from app.schemas.food import FoodCreate, FoodResponse, FoodSearchResult, FoodUpdate, NutrientData
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
        serving_size_g=food.serving_size_g,
        serving_label=food.serving_label,
        nutrients=nutrients,
    )


@router.get("/search", response_model=list[FoodSearchResult])
async def search_foods(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    if len(q) >= 2:
        results = await food_service.search_foods_with_fallback(db, q, limit)
    else:
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Food not found for barcode", "code": "BARCODE_NOT_FOUND", "barcode": code},
        )
    return _food_to_response(food)


@router.post("", response_model=FoodResponse, status_code=status.HTTP_201_CREATED)
async def create_food(
    body: FoodCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    food = await food_service.create_food(db, body)
    return _food_to_response(food)


@router.put("/{food_id}", response_model=FoodResponse)
async def update_food(
    food_id: UUID,
    body: FoodUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    result = await db.execute(select(Food).where(Food.id == food_id))
    food = result.scalar_one_or_none()
    if food is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "FOOD_NOT_FOUND"},
        )
    data = body.model_dump(exclude_unset=True)
    nutrients_data = data.pop("nutrients", None)
    for field, value in data.items():
        setattr(food, field, value)
    if nutrients_data is not None and food.nutrients:
        for field, value in nutrients_data.items():
            setattr(food.nutrients, field, value)
    await db.commit()
    await db.refresh(food)
    return _food_to_response(food)


@router.delete("/{food_id}", status_code=204)
async def delete_food(
    food_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_api_key),
):
    result = await db.execute(select(Food).where(Food.id == food_id))
    food = result.scalar_one_or_none()
    if food is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "FOOD_NOT_FOUND"},
        )
    # Check if any food logs reference this food
    ref_result = await db.execute(select(FoodLog.id).where(FoodLog.food_id == food_id).limit(1))
    if ref_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409,
            detail={"code": "FOOD_IN_USE", "detail": "Cannot delete food that is referenced by food logs"},
        )
    await db.delete(food)
    await db.commit()
