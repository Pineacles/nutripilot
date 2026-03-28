export interface MacroTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealItem {
  food_name: string;
  quantity_g: number;
  kcal: number | null;
}

export interface MealGroup {
  meal_type: string;
  items: MealItem[];
}

export interface SupplementEntry {
  name: string;
  dose_amount: number;
  dose_unit: string;
  time_of_day: string | null;
}

export interface TodaySummary {
  date: string;
  totals: MacroTotals;
  targets: MacroTotals;
  meals: MealGroup[];
  supplements: SupplementEntry[];
}

export interface MicronutrientAverages {
  calcium: number | null;
  potassium: number | null;
  omega3: number | null;
  zinc: number | null;
  vit_d: number | null;
  vit_k2: number | null;
  vit_c: number | null;
  magnesium: number | null;
  b12: number | null;
  iron: number | null;
}

export interface WeightDelta {
  start_kg: number | null;
  end_kg: number | null;
  delta: number | null;
}

export interface WeekSummary {
  start_date: string;
  end_date: string;
  daily_avg: MacroTotals;
  micronutrient_avg: MicronutrientAverages;
  weight: WeightDelta;
}

export interface WeightEntry {
  date: string;
  weight_kg: number;
  body_fat_pct: number | null;
}
