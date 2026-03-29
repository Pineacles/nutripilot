import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class FoodLogCreate(BaseModel):
    food_id: UUID
    quantity_g: float = Field(gt=0, le=10000)
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"]
    date: Optional[datetime.date] = None


class FoodLogByBarcodeCreate(BaseModel):
    barcode: str
    quantity_g: float = Field(gt=0, le=10000)
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"]
    date: Optional[datetime.date] = None


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
