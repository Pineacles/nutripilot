from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class NutrientData(BaseModel):
    kcal: float | None = None
    protein: float | None = None
    carbs: float | None = None
    sugar: float | None = None
    fiber: float | None = None
    fat: float | None = None
    sat_fat: float | None = None
    salt: float | None = None
    calcium: float | None = None
    potassium: float | None = None
    omega3: float | None = None
    zinc: float | None = None
    vit_d: float | None = None
    vit_k2: float | None = None
    vit_c: float | None = None
    magnesium: float | None = None
    b12: float | None = None
    iron: float | None = None
    alcohol: float | None = None
    caffeine_mg: float | None = None


class FoodCreate(BaseModel):
    name: str = Field(min_length=1, max_length=500)
    barcode: str | None = Field(default=None, min_length=4, max_length=50)
    serving_size_g: float | None = None
    serving_label: str | None = Field(default=None, max_length=100)
    nutrients: NutrientData


class FoodUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=500)
    barcode: Optional[str] = Field(None, min_length=4, max_length=50)
    serving_size_g: Optional[float] = None
    serving_label: Optional[str] = Field(None, max_length=100)
    nutrients: Optional[NutrientData] = None


class FoodCorrectionUpdate(BaseModel):
    serving_size_g: Optional[float] = Field(None, gt=0)
    serving_label: Optional[str] = Field(None, max_length=100)
    name: Optional[str] = Field(None, min_length=1, max_length=500)
    nutrients: Optional[NutrientData] = None

    @model_validator(mode="after")
    def check_at_least_one_field(self):
        if (
            self.serving_size_g is None
            and self.serving_label is None
            and self.name is None
            and self.nutrients is None
        ):
            raise ValueError("At least one field must be provided")
        return self


class FoodClone(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=500)


class FoodResponse(BaseModel):
    id: UUID
    name: str
    barcode: str | None
    source: str
    serving_size_g: float | None = None
    serving_label: str | None = None
    nutrients: NutrientData | None
    # is_mine: the current user owns this food. editable: the current user may
    # PUT/DELETE it (owner-only; official curated foods are read-only).
    is_mine: bool = False
    editable: bool = False

    model_config = {"from_attributes": True}


class FoodSearchResult(BaseModel):
    id: UUID | None = None
    name: str
    barcode: str | None = None
    kcal: float | None = None
    protein: float | None = None
    source: str | None = None
    serving_size_g: float | None = None
    serving_label: str | None = None

    model_config = {"from_attributes": True}
