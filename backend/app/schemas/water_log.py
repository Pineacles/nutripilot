import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class WaterLogCreate(BaseModel):
    amount_ml: float = Field(gt=0, le=10000)
    date: Optional[datetime.date] = None

class WaterLogUpdate(BaseModel):
    amount_ml: Optional[float] = Field(None, gt=0, le=10000)

class WaterLogResponse(BaseModel):
    id: UUID
    amount_ml: float
    date: datetime.date
    logged_at: Optional[datetime.datetime] = None
    model_config = {"from_attributes": True}
