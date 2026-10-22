import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


def _check_quantity_or_servings(model):
    """Shared validator: exactly one of quantity_g / servings must be set."""
    if model.quantity_g is None and model.servings is None:
        raise ValueError("Either quantity_g or servings must be provided")
    return model


def _check_serving_id(model):
    """serving_id names the unit for servings, so it means nothing without them."""
    if getattr(model, "serving_id", None) is not None and (model.servings is None or model.quantity_g is not None):
        raise ValueError("serving_id needs servings and no quantity_g")
    return model


class FoodLogCreate(BaseModel):
    food_id: UUID
    quantity_g: Optional[float] = Field(None, gt=0, le=10000)
    servings: Optional[float] = Field(None, gt=0, le=100)
    # With servings: count them in one of the user's named servings instead of the food's own size.
    serving_id: Optional[UUID] = None
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"]
    date: Optional[datetime.date] = None

    _check_quantity_or_servings = model_validator(mode="after")(_check_quantity_or_servings)
    _check_serving_id = model_validator(mode="after")(_check_serving_id)


class FoodLogByBarcodeCreate(BaseModel):
    barcode: str
    quantity_g: Optional[float] = Field(None, gt=0, le=10000)
    servings: Optional[float] = Field(None, gt=0, le=100)
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"]
    date: Optional[datetime.date] = None

    _check_quantity_or_servings = model_validator(mode="after")(_check_quantity_or_servings)


class FoodLogByNameCreate(BaseModel):
    food_name: str = Field(min_length=1, max_length=500)
    quantity_g: Optional[float] = Field(None, gt=0, le=10000)
    servings: Optional[float] = Field(None, gt=0, le=100)
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"]
    date: Optional[datetime.date] = None

    _check_quantity_or_servings = model_validator(mode="after")(_check_quantity_or_servings)


class FoodLogUpdate(BaseModel):
    quantity_g: Optional[float] = Field(None, gt=0, le=10000)
    # Alternative to quantity_g: number of servings, converted with the food's serving size.
    servings: Optional[float] = Field(None, gt=0, le=100)
    serving_id: Optional[UUID] = None
    meal_type: Optional[Literal["breakfast", "lunch", "dinner", "snack"]] = None
    date: Optional[datetime.date] = None

    _check_serving_id = model_validator(mode="after")(_check_serving_id)


MealType = Literal["breakfast", "lunch", "dinner", "snack"]


class FoodLogCopy(BaseModel):
    """Copy one meal (or a whole day when meal_type is left out) to another day or meal."""
    from_date: datetime.date
    to_date: datetime.date
    meal_type: Optional[MealType] = None
    # Defaults to the same meal. Only allowed together with meal_type.
    to_meal_type: Optional[MealType] = None

    @model_validator(mode="after")
    def _check(self):
        if self.to_meal_type and not self.meal_type:
            raise ValueError("to_meal_type needs meal_type")
        if self.from_date == self.to_date and (self.to_meal_type or self.meal_type) == self.meal_type:
            raise ValueError("Copying onto the same day and meal would only duplicate it")
        return self


class FoodLogResponse(BaseModel):
    id: UUID
    food_name: str
    quantity_g: float
    amount: Optional[float] = None
    unit: Optional[str] = None
    unit_label: Optional[str] = None
    meal_type: str
    date: datetime.date
    kcal: Optional[float] = None
    protein: Optional[float] = None
    carbs: Optional[float] = None
    fat: Optional[float] = None
    serving_size_g: Optional[float] = None
    serving_label: Optional[str] = None


class NutrientsPer100g(BaseModel):
    kcal: Optional[float] = None
    protein: Optional[float] = None
    carbs: Optional[float] = None
    sugar: Optional[float] = None
    fiber: Optional[float] = None
    fat: Optional[float] = None
    sat_fat: Optional[float] = None
    salt: Optional[float] = None
    calcium: Optional[float] = None
    potassium: Optional[float] = None
    omega3: Optional[float] = None
    zinc: Optional[float] = None
    vit_d: Optional[float] = None
    vit_c: Optional[float] = None
    magnesium: Optional[float] = None
    b12: Optional[float] = None
    iron: Optional[float] = None
    alcohol: Optional[float] = None
    caffeine_mg: Optional[float] = None

    model_config = {"from_attributes": True}


class FoodLogDetail(BaseModel):
    """Full detail of a food log entry with food info and calculated nutrients."""
    id: UUID
    food_id: UUID
    food_name: str
    food_source: str
    barcode: Optional[str] = None
    serving_size_g: Optional[float] = None
    serving_label: Optional[str] = None
    quantity_g: float
    # What the user typed: amount in unit ("g" or "serving"); older entries are grams.
    amount: Optional[float] = None
    unit: Optional[str] = None
    # Named serving used ("slice"); None for the food's own serving size or grams.
    unit_label: Optional[str] = None
    meal_type: str
    date: datetime.date
    logged_at: Optional[datetime.datetime] = None
    # Nutrients for the actual quantity consumed
    nutrients_consumed: NutrientsPer100g
    # Nutrients per 100g (reference)
    nutrients_per_100g: Optional[NutrientsPer100g] = None


class DailyLogResponse(BaseModel):
    """All food logs for a specific date with full detail."""
    date: datetime.date
    total_items: int
    total_kcal: float
    entries: list[FoodLogDetail]
