import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CaffeineLogCreate(BaseModel):
    amount_mg: float = Field(gt=0, le=5000)
    source_name: Optional[str] = Field(None, max_length=100)
    date: Optional[datetime.date] = None

class CaffeineLogUpdate(BaseModel):
    amount_mg: Optional[float] = Field(None, gt=0, le=5000)
    source_name: Optional[str] = Field(None, max_length=100)

class CaffeineLogResponse(BaseModel):
    id: UUID
    amount_mg: float
    source_name: Optional[str] = None
    date: datetime.date
    logged_at: Optional[datetime.datetime] = None
    model_config = {"from_attributes": True}
