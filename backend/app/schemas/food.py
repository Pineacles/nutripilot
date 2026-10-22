from typing import Annotated, Optional
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


# Typed in values: never negative, never NaN or infinity. No upper limit, because rough "whole meal"
# foods are stored with the meal as 100 g (1000 kcal, 120 g carbs).
_Amount = Annotated[float | None, Field(default=None, ge=0, allow_inf_nan=False)]


class NutrientInput(NutrientData):
    kcal: _Amount = None
    protein: _Amount = None
    carbs: _Amount = None
    sugar: _Amount = None
    fiber: _Amount = None
    fat: _Amount = None
    sat_fat: _Amount = None
    salt: _Amount = None
    calcium: _Amount = None
    potassium: _Amount = None
    omega3: _Amount = None
    zinc: _Amount = None
    vit_d: _Amount = None
    vit_k2: _Amount = None
    vit_c: _Amount = None
    magnesium: _Amount = None
    b12: _Amount = None
    iron: _Amount = None
    alcohol: _Amount = None
    caffeine_mg: _Amount = None


_ServingG = Annotated[float | None, Field(default=None, gt=0, le=10000, allow_inf_nan=False)]


class FoodCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    barcode: str | None = Field(default=None, min_length=4, max_length=50)
    serving_size_g: _ServingG = None
    serving_label: str | None = Field(default=None, max_length=100)
    nutrients: NutrientInput


class FoodUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    barcode: Optional[str] = Field(None, min_length=4, max_length=50)
    serving_size_g: _ServingG = None
    serving_label: Optional[str] = Field(None, max_length=100)
    nutrients: Optional[NutrientInput] = None


class FoodCorrectionUpdate(BaseModel):
    serving_size_g: _ServingG = None
    serving_label: Optional[str] = Field(None, max_length=100)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    nutrients: Optional[NutrientInput] = None

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
    name: str | None = Field(default=None, min_length=1, max_length=255)


class ServingCreate(BaseModel):
    label: str = Field(min_length=1, max_length=40)
    grams: float = Field(gt=0, le=5000)

    @model_validator(mode="after")
    def _strip(self):
        self.label = self.label.strip()
        if not self.label:
            raise ValueError("label must not be blank")
        return self


class ServingResponse(BaseModel):
    id: UUID
    label: str
    grams: float

    model_config = {"from_attributes": True}


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
    # Extra named servings the current user added to this food ("slice" = 30 g). Filled by food detail
    # and barcode lookup; None where they are not loaded (it does not mean "no servings").
    servings: list[ServingResponse] | None = None

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
