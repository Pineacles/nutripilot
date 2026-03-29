import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class SupplementCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    dose_amount: float = Field(gt=0, le=100000)
    dose_unit: Literal["mg", "g", "IU", "mcg", "\u00b5g", "ml"] = "g"
    time_of_day: Optional[Literal["morning", "afternoon", "evening"]] = None
    date: Optional[datetime.date] = None


class SupplementLogUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    dose_amount: Optional[float] = Field(None, gt=0, le=100000)
    dose_unit: Optional[Literal["mg", "g", "IU", "mcg", "µg", "ml"]] = None
    time_of_day: Optional[Literal["morning", "afternoon", "evening"]] = None
    date: Optional[datetime.date] = None


class SupplementResponse(BaseModel):
    id: UUID
    name: str
    dose_amount: float
    dose_unit: str
    time_of_day: Optional[str] = None
    date: datetime.date
