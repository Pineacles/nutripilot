import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class SupplementCreate(BaseModel):
    name: str
    dose_amount: float
    dose_unit: str = "g"
    time_of_day: Optional[str] = None  # morning | afternoon | evening
    date: Optional[datetime.date] = None


class SupplementResponse(BaseModel):
    id: UUID
    name: str
    dose_amount: float
    dose_unit: str
    time_of_day: Optional[str] = None
    date: datetime.date
