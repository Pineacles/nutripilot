import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class FoodLogCreate(BaseModel):
    food_id: UUID
    quantity_g: Optional[float] = Field(None, gt=0, le=10000)
    servings: Optional[float] = Field(None, gt=0, le=100)
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"]
    date: Optional[datetime.date] = None

    @model_validator(mode="after")
    def check_quantity_or_servings(self):
        if self.quantity_g is None and self.servings is None:
            raise ValueError("Either quantity_g or servings must be provided")
        return self


class FoodLogByBarcodeCreate(BaseModel):
    barcode: str
    quantity_g: Optional[float] = Field(None, gt=0, le=10000)
    servings: Optional[float] = Field(None, gt=0, le=100)
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"]
    date: Optional[datetime.date] = None

    @model_validator(mode="after")
    def check_quantity_or_servings(self):
        if self.quantity_g is None and self.servings is None:
            raise ValueError("Either quantity_g or servings must be provided")
        return self


class FoodLogByNameCreate(BaseModel):
    food_name: str = Field(min_length=1, max_length=500)
    quantity_g: Optional[float] = Field(None, gt=0, le=10000)
    servings: Optional[float] = Field(None, gt=0, le=100)
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"]
    date: Optional[datetime.date] = None

    @model_validator(mode="after")
    def check_quantity_or_servings(self):
        if self.quantity_g is None and self.servings is None:
            raise ValueError("Either quantity_g or servings must be provided")
        return self


class FoodLogUpdate(BaseModel):
    quantity_g: Optional[float] = Field(None, gt=0, le=10000)
    meal_type: Optional[Literal["breakfast", "lunch", "dinner", "snack"]] = None
    date: Optional[datetime.date] = None


class FoodLogResponse(BaseModel):
    id: UUID
    food_name: str
    quantity_g: float
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
