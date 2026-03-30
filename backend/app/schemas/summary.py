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
    alcohol: float = 0


class MacroTargets(BaseModel):
    kcal: float
    protein: float
    carbs: float
    fat: float
    fiber: float
    sugar: float
    sodium: float  # mg
    alcohol: float


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


class DailyWater(BaseModel):
    date: datetime.date
    total_ml: float


class DailyCaffeine(BaseModel):
    date: datetime.date
    total_mg: float


class WaterTotals(BaseModel):
    total_ml: float
    target_ml: float


class CaffeineTotals(BaseModel):
    total_mg: float
    target_mg: float


class TodaySummary(BaseModel):
    date: datetime.date
    totals: MacroTotals
    targets: MacroTargets
    meals: list[MealGroup]
    supplements: list[SupplementEntry]
    water: WaterTotals
    caffeine: CaffeineTotals


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
    body_fat_kg: Optional[float] = None
    muscle_mass_kg: Optional[float] = None


class DailyCalories(BaseModel):
    date: datetime.date
    kcal: float


class WeekSummary(BaseModel):
    start_date: datetime.date
    end_date: datetime.date
    daily_avg: MacroTotals
    daily_calories: list[DailyCalories]
    micronutrient_avg: MicronutrientAverages
    weight: WeightDelta
    body_comp: list[BodyCompEntry]
    daily_water: list[DailyWater]
    daily_caffeine: list[DailyCaffeine]


class DailyNutrition(BaseModel):
    date: datetime.date
    kcal: float
    protein: float
    carbs: float
    fat: float
    fiber: float
    sugar: float
    sodium: float
    alcohol: float


class DailyMicros(BaseModel):
    date: datetime.date
    calcium: Optional[float] = None
    potassium: Optional[float] = None
    omega3: Optional[float] = None
    zinc: Optional[float] = None
    vit_d: Optional[float] = None
    vit_c: Optional[float] = None
    magnesium: Optional[float] = None
    b12: Optional[float] = None
    iron: Optional[float] = None


class SupplementLogEntry(BaseModel):
    date: datetime.date
    count: int
    names: list[str]


class StatsSummary(BaseModel):
    weight_history: list[BodyCompEntry]
    daily_nutrition: list[DailyNutrition]
    daily_micros: list[DailyMicros]
    supplement_log: list[SupplementLogEntry]
    macro_avg: MacroTotals
    micro_avg: MicronutrientAverages
    days_logged: int
    total_days: int
    supplement_adherence_pct: float
    highest_protein_day: Optional[dict] = None  # {date, protein}
    lowest_calorie_day: Optional[dict] = None  # {date, kcal}
    highest_calorie_day: Optional[dict] = None  # {date, kcal}
    best_fiber_day: Optional[dict] = None  # {date, fiber}
    daily_water: list[DailyWater]
    daily_caffeine: list[DailyCaffeine]
    avg_water_ml: float = 0
    avg_caffeine_mg: float = 0
    avg_daily_kcal: float = 0
    current_streak: int
