import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class WeightLogCreate(BaseModel):
    weight_kg: float = Field(gt=0, le=500)
    body_fat_pct: Optional[float] = Field(default=None, ge=0, le=100)
    muscle_mass_pct: Optional[float] = Field(default=None, ge=0, le=100)
    body_fat_kg: Optional[float] = Field(default=None, ge=0, le=300)
    muscle_mass_kg: Optional[float] = Field(default=None, ge=0, le=300)
    source: Optional[str] = Field(default=None, max_length=50)
    date: Optional[datetime.date] = None


class WeightLogUpdate(BaseModel):
    weight_kg: Optional[float] = Field(None, gt=0, le=500)
    body_fat_pct: Optional[float] = Field(None, ge=0, le=100)
    muscle_mass_pct: Optional[float] = Field(None, ge=0, le=100)
    body_fat_kg: Optional[float] = Field(None, ge=0, le=300)
    muscle_mass_kg: Optional[float] = Field(None, ge=0, le=300)
    log_date: Optional[datetime.date] = Field(
        None,
        description=(
            "Change the entry's date. Only allowed when the row's source is 'manual': "
            "synced rows use (user_id, date, source) as their upsert key, so moving the "
            "date on a synced row would corrupt future syncs."
        ),
    )


class WeightLogResponse(BaseModel):
    id: UUID
    weight_kg: float
    body_fat_pct: Optional[float] = None
    muscle_mass_pct: Optional[float] = None
    body_fat_kg: Optional[float] = None
    muscle_mass_kg: Optional[float] = None
    source: str
    date: datetime.date
    created_at: Optional[datetime.datetime] = None

    model_config = {"from_attributes": True}
