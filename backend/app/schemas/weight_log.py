import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class WeightLogCreate(BaseModel):
    weight_kg: float
    body_fat_pct: Optional[float] = None
    date: Optional[datetime.date] = None


class WeightLogResponse(BaseModel):
    id: UUID
    weight_kg: float
    body_fat_pct: Optional[float] = None
    source: str
    date: datetime.date
