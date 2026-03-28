import datetime
from typing import Optional

from pydantic import BaseModel


class MacroTotals(BaseModel):
    kcal: float
    protein: float
    carbs: float
    fat: float
    fiber: float = 0
    sugar: float = 0
    sodium: float = 0  # mg


class MacroTargets(BaseModel):
    kcal: float
    protein: float
    carbs: float
    fat: float
    fiber: float
    sugar: float
    sodium: float  # mg


class MealItem(BaseModel):
    food_name: str
    quantity_g: float
    kcal: Optional[float] = None


class MealGroup(BaseModel):
    meal_type: str
    items: list[MealItem]


class SupplementEntry(BaseModel):
    name: str
    dose_amount: float
    dose_unit: str
    time_of_day: Optional[str] = None


class TodaySummary(BaseModel):
    date: datetime.date
    totals: MacroTotals
    targets: MacroTargets
    meals: list[MealGroup]
    supplements: list[SupplementEntry]


class MicronutrientAverages(BaseModel):
    calcium: Optional[float] = None
    potassium: Optional[float] = None
    omega3: Optional[float] = None
    zinc: Optional[float] = None
    vit_d: Optional[float] = None
    vit_k2: Optional[float] = None
    vit_c: Optional[float] = None
    magnesium: Optional[float] = None
    b12: Optional[float] = None
    iron: Optional[float] = None


class WeightDelta(BaseModel):
    start_kg: Optional[float] = None
    end_kg: Optional[float] = None
    delta: Optional[float] = None


class BodyCompEntry(BaseModel):
    date: datetime.date
    weight_kg: float
    body_fat_pct: Optional[float] = None
    muscle_mass_pct: Optional[float] = None


class WeekSummary(BaseModel):
    start_date: datetime.date
    end_date: datetime.date
    daily_avg: MacroTotals
    micronutrient_avg: MicronutrientAverages
    weight: WeightDelta
    body_comp: list[BodyCompEntry]


class StatsSummary(BaseModel):
    weight_history: list[BodyCompEntry]
    daily_calories: list[dict]  # [{date, kcal}]
    macro_avg: MacroTotals
    days_logged: int
    total_days: int
    supplement_adherence_pct: float
    highest_protein_day: Optional[dict] = None  # {date, protein}
    lowest_calorie_day: Optional[dict] = None  # {date, kcal}
    current_streak: int
