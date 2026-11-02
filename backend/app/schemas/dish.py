from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.food import NutrientData

_Grams = Field(gt=0, le=10000, allow_inf_nan=False)


class DishComponentInput(BaseModel):
    food_id: UUID
    quantity_g: float = _Grams


class DishCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    components: list[DishComponentInput] = Field(min_length=1, max_length=30)
    # One portion in grams. Omitted: the whole dish (the sum of the component quantities).
    portion_g: float | None = Field(default=None, gt=0, le=10000, allow_inf_nan=False)
    private: bool = True


class DishUpdate(BaseModel):
    """Replaces the components and recomputes the nutrients. Name and privacy are kept unless sent."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    components: list[DishComponentInput] = Field(min_length=1, max_length=30)
    portion_g: float | None = Field(default=None, gt=0, le=10000, allow_inf_nan=False)
    private: bool | None = None


class DishComponentResponse(BaseModel):
    food_id: UUID
    name: str
    quantity_g: float
    kcal: float | None = None


class DishResponse(BaseModel):
    id: UUID
    name: str
    # Weight of one portion; logging with servings=1 eats exactly this much.
    serving_size_g: float | None = None
    # Per 100 g of the dish, like every food.
    nutrients: NutrientData | None = None
    components: list[DishComponentResponse]
