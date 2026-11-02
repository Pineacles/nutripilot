"""Dishes: a complete meal built from other foods.

A dish is an ordinary Food (source 'dish') plus FoodComponent rows. Its per-100 g nutrients
are a snapshot computed from the components when the dish is saved, so searching, logging
and summaries treat it like any food. Editing a component food later does not change
dishes already built from it: save the dish again (PUT) to recompute.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.food import Food
from app.models.food_component import FoodComponent
from app.models.nutrient import Nutrient
from app.schemas.dish import DishComponentInput, DishComponentResponse, DishResponse
from app.schemas.food import NutrientData
from app.services.food_service import _NUTRIENT_FIELDS, get_food_by_id


def compute_dish_nutrients(parts: list[tuple[object | None, float]]) -> dict[str, float | None]:
    """Per-100 g nutrients of the whole dish from ``(nutrients, grams)`` parts.

    Each part's values are per 100 g of that part. A nutrient is None only when every part
    lacks it; a part without it counts as 0 next to parts that have it.
    """
    total_g = sum(g for _, g in parts)
    result: dict[str, float | None] = {}
    for field in _NUTRIENT_FIELDS:
        values = [(getattr(n, field, None) if n is not None else None, g) for n, g in parts]
        if all(v is None for v, _ in values):
            result[field] = None
        else:
            result[field] = sum((v or 0) * g / 100 for v, g in values) / total_g * 100
    return result


async def _resolve_components(
    db: AsyncSession, user_id: UUID, components: list[DishComponentInput], dish_id: UUID | None = None
) -> list[Food]:
    foods = []
    for comp in components:
        food = None if comp.food_id == dish_id else await get_food_by_id(db, comp.food_id, user_id)
        if food is None:
            raise HTTPException(
                status_code=404, detail={"code": "FOOD_NOT_FOUND", "food_id": str(comp.food_id)}
            )
        foods.append(food)
    return foods


def _public_check(foods: list[Food], private: bool) -> None:
    if not private and any(f.private for f in foods):
        raise HTTPException(
            status_code=422,
            detail={"code": "PRIVATE_COMPONENT", "detail": "A public dish cannot contain private foods"},
        )


async def assert_components_public(db: AsyncSession, dish_id: UUID) -> None:
    rows = await db.execute(
        select(Food.id)
        .join(FoodComponent, FoodComponent.component_food_id == Food.id)
        .where(FoodComponent.food_id == dish_id, Food.private.is_(True))
        .limit(1)
    )
    if rows.first() is not None:
        raise HTTPException(
            status_code=422,
            detail={"code": "PRIVATE_COMPONENT", "detail": "A public dish cannot contain private foods"},
        )


async def is_component(db: AsyncSession, food_id: UUID) -> bool:
    row = await db.execute(select(FoodComponent.id).where(FoodComponent.component_food_id == food_id).limit(1))
    return row.first() is not None


async def _store(
    db: AsyncSession, dish: Food, foods: list[Food], components: list[DishComponentInput], portion_g: float | None
) -> None:
    parts = [(f.nutrients, c.quantity_g) for f, c in zip(foods, components, strict=True)]
    total_g = sum(c.quantity_g for c in components)
    values = compute_dish_nutrients(parts)
    dish.serving_size_g = portion_g or total_g
    dish.serving_label = "1 portion"
    if dish.nutrients is None:
        dish.nutrients = Nutrient()
    for field, value in values.items():
        setattr(dish.nutrients, field, value)
    await db.execute(delete(FoodComponent).where(FoodComponent.food_id == dish.id))
    db.add_all(
        FoodComponent(food_id=dish.id, component_food_id=f.id, quantity_g=c.quantity_g, position=i)
        for i, (f, c) in enumerate(zip(foods, components, strict=True))
    )


async def create_dish(
    db: AsyncSession, user_id: UUID, name: str, components: list[DishComponentInput],
    portion_g: float | None, private: bool,
) -> Food:
    foods = await _resolve_components(db, user_id, components)
    _public_check(foods, private)
    dish = Food(name=name, source="dish", created_by=user_id, private=private, nutrients=Nutrient())
    db.add(dish)
    await db.flush()
    await _store(db, dish, foods, components, portion_g)
    await db.commit()
    await db.refresh(dish)
    return dish


async def get_own_dish(db: AsyncSession, user_id: UUID, dish_id: UUID) -> Food:
    dish = await get_food_by_id(db, dish_id, user_id)
    if dish is None or dish.source != "dish" or dish.created_by != user_id:
        raise HTTPException(status_code=404, detail={"code": "DISH_NOT_FOUND"})
    return dish


async def update_dish(
    db: AsyncSession, user_id: UUID, dish: Food, name: str | None, components: list[DishComponentInput],
    portion_g: float | None, private: bool | None,
) -> Food:
    foods = await _resolve_components(db, user_id, components, dish_id=dish.id)
    _public_check(foods, dish.private if private is None else private)
    if name is not None:
        dish.name = name
    if private is not None:
        dish.private = private
    await _store(db, dish, foods, components, portion_g)
    await db.commit()
    await db.refresh(dish)
    return dish


async def dish_response(db: AsyncSession, dish: Food) -> DishResponse:
    """A component another user has since made private stays in the sums but is shown without its name."""
    rows = await db.execute(
        select(FoodComponent, Food)
        .join(Food, Food.id == FoodComponent.component_food_id)
        .where(FoodComponent.food_id == dish.id)
        .order_by(FoodComponent.position)
    )
    components = [
        DishComponentResponse(
            food_id=food.id,
            name=food.name if not food.private or food.created_by == dish.created_by else "(a private food)",
            quantity_g=comp.quantity_g,
            kcal=round(food.nutrients.kcal * comp.quantity_g / 100, 1)
            if food.nutrients is not None and food.nutrients.kcal is not None else None,
        )
        for comp, food in rows.all()
    ]
    return DishResponse(
        id=dish.id, name=dish.name, serving_size_g=dish.serving_size_g,
        nutrients=NutrientData.model_validate(dish.nutrients, from_attributes=True) if dish.nutrients is not None else None,
        components=components,
    )
