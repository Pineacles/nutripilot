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
