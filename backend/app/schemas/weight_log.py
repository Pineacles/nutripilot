import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class WeightLogCreate(BaseModel):
    weight_kg: float = Field(gt=0, le=500)
    body_fat_pct: Optional[float] = Field(default=None, ge=0, le=100)
    muscle_mass_pct: Optional[float] = Field(default=None, ge=0, le=100)
    date: Optional[datetime.date] = None


class WeightLogResponse(BaseModel):
    id: UUID
    weight_kg: float
    body_fat_pct: Optional[float] = None
    muscle_mass_pct: Optional[float] = None
    source: str
    date: datetime.date
