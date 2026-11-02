from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator

Sex = Literal["female", "male"]
ActivityLevel = Literal["sedentary", "light", "moderate", "active", "very_active"]


class ProfileUpdate(BaseModel):
    """Partial update: only the fields sent change; send null to clear one."""

    height_cm: float | None = Field(default=None, ge=100, le=250, allow_inf_nan=False)
    birth_year: int | None = Field(default=None, ge=1900)
    sex: Sex | None = None
    activity_level: ActivityLevel | None = None

    @field_validator("birth_year")
    @classmethod
    def _not_a_child(cls, v: int | None) -> int | None:
        if v is not None and v > date.today().year - 10:
            raise ValueError(f"birth_year must be between 1900 and {date.today().year - 10}")
        return v


class ProfileResponse(BaseModel):
    height_cm: float | None = None
    birth_year: int | None = None
    sex: str | None = None
    activity_level: str | None = None
    target_kcal: int | None = None
    target_protein_g: float | None = None
    target_weight_kg: float | None = None
    target_body_fat_pct: float | None = None
    timezone: str

    model_config = {"from_attributes": True}
