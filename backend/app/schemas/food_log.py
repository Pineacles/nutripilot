import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class FoodLogCreate(BaseModel):
    food_id: UUID
    quantity_g: float
    meal_type: str  # breakfast | lunch | dinner | snack
    date: Optional[datetime.date] = None


class FoodLogByBarcodeCreate(BaseModel):
    barcode: str
    quantity_g: float
    meal_type: str
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
