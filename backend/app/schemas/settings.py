from typing import Optional
from uuid import UUID
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field, field_validator, model_validator


class NutritionTargetsUpdate(BaseModel):
    target_kcal: int = Field(gt=0, le=10000)
    target_protein_g: float = Field(ge=0, le=1000)
    target_carbs_g: float = Field(ge=0, le=1000)
    target_fat_g: float = Field(ge=0, le=500)
    target_fiber_g: float = Field(default=30, ge=0, le=200)
    target_sugar_g: float = Field(default=50, ge=0, le=500)
    target_sodium_mg: float = Field(default=2300, ge=0, le=10000)
    target_alcohol_g: float = Field(ge=0, le=500)
    target_water_ml: float = Field(ge=0, le=20000)
    target_caffeine_mg: float = Field(ge=0, le=5000)
    target_weight_kg: float | None = Field(default=None, gt=0, le=500)
    target_body_fat_pct: float | None = Field(default=None, ge=0, le=100)
    timezone: str | None = Field(
        default=None, description="IANA timezone name (e.g. 'Europe/Zurich') used for day boundaries."
    )

    @field_validator("timezone")
    @classmethod
    def _validate_timezone(cls, v: str | None) -> str | None:
        if v is None:
            return v
        try:
            ZoneInfo(v)
        except Exception as exc:
            raise ValueError(
                f"Invalid timezone {v!r}. Use an IANA name like 'Europe/Zurich' or 'America/New_York'."
            ) from exc
        return v


class NutritionTargetsResponse(BaseModel):
    target_kcal: int
    target_protein_g: float
    target_carbs_g: float
    target_fat_g: float
    target_fiber_g: float
    target_sugar_g: float
    target_sodium_mg: float
    target_alcohol_g: float
    target_water_ml: float
    target_caffeine_mg: float
    target_weight_kg: float | None = None
    target_body_fat_pct: float | None = None
    timezone: str | None = None


class MicronutrientTargetItem(BaseModel):
    nutrient: str = Field(min_length=1, max_length=50)
    target_value: float = Field(gt=0, le=100000)
    unit: str = Field(min_length=1, max_length=10)


class MicronutrientTargetsUpdate(BaseModel):
    targets: list[MicronutrientTargetItem]

    @model_validator(mode="after")
    def _one_per_nutrient(self):
        names = [t.nutrient for t in self.targets]
        if len(names) != len(set(names)):
            raise ValueError("each nutrient can only have one target")
        return self


class SupplementDefinitionCreate(BaseModel):
    # Lengths match the columns, so a long value is a 422 instead of a database error.
    name: str = Field(min_length=1, max_length=255)
    dose_amount: float = Field(gt=0, le=100000, allow_inf_nan=False)
    dose_unit: str = Field("mg", min_length=1, max_length=10)
    time_of_day: Optional[str] = Field(None, max_length=20)
    micronutrients: Optional[dict] = None


class SupplementDefinitionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    dose_amount: Optional[float] = Field(None, gt=0, le=100000, allow_inf_nan=False)
    dose_unit: Optional[str] = Field(None, min_length=1, max_length=10)
    time_of_day: Optional[str] = Field(None, max_length=20)
    active: Optional[bool] = None
    micronutrients: Optional[dict] = None


class SupplementDefinitionResponse(BaseModel):
    id: UUID
    name: str
    dose_amount: float
    dose_unit: str
    time_of_day: Optional[str]
    active: bool
    micronutrients: Optional[dict]

    model_config = {"from_attributes": True}


class ApiKeyResponse(BaseModel):
    api_key_masked: str
    api_key: Optional[str] = None  # only returned on regenerate


# What Settings, Tracked nutrients can switch off. Calories always stay.
TRACKABLE_NUTRIENTS = (
    "protein", "carbs", "fat", "fiber", "sugar", "sat_fat", "salt",
    "calcium", "potassium", "omega3", "zinc", "vit_d", "vit_k2", "vit_c", "magnesium", "b12", "iron",
    "water", "caffeine", "alcohol",
)


class TrackedNutrientsUpdate(BaseModel):
    hidden: list[str] = Field(max_length=len(TRACKABLE_NUTRIENTS))

    @field_validator("hidden")
    @classmethod
    def known_nutrients(cls, value: list[str]) -> list[str]:
        unknown = sorted(set(value) - set(TRACKABLE_NUTRIENTS))
        if unknown:
            raise ValueError(f"unknown nutrients: {', '.join(unknown)}")
        return [n for n in TRACKABLE_NUTRIENTS if n in value]


class UserSettingsResponse(BaseModel):
    nutrition_targets: NutritionTargetsResponse
    micronutrient_targets: list[MicronutrientTargetItem]
    supplement_definitions: list[SupplementDefinitionResponse]
    api_key_masked: str
    hidden_nutrients: list[str] = []
