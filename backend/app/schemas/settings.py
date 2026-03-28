import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class NutritionTargetsUpdate(BaseModel):
    target_kcal: int
    target_protein_g: float
    target_carbs_g: float
    target_fat_g: float
    target_fiber_g: float = 30
    target_sugar_g: float = 50
    target_sodium_mg: float = 2300


class NutritionTargetsResponse(BaseModel):
    target_kcal: int
    target_protein_g: float
    target_carbs_g: float
    target_fat_g: float
    target_fiber_g: float
    target_sugar_g: float
    target_sodium_mg: float


class MicronutrientTargetItem(BaseModel):
    nutrient: str
    target_value: float
    unit: str


class MicronutrientTargetsUpdate(BaseModel):
    targets: list[MicronutrientTargetItem]


class SupplementDefinitionCreate(BaseModel):
    name: str
    dose_amount: float
    dose_unit: str = "mg"
    time_of_day: Optional[str] = None
    micronutrients: Optional[dict] = None


class SupplementDefinitionUpdate(BaseModel):
    name: Optional[str] = None
    dose_amount: Optional[float] = None
    dose_unit: Optional[str] = None
    time_of_day: Optional[str] = None
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


class UserSettingsResponse(BaseModel):
    nutrition_targets: NutritionTargetsResponse
    micronutrient_targets: list[MicronutrientTargetItem]
    supplement_definitions: list[SupplementDefinitionResponse]
    api_key_masked: str
