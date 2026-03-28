export interface MacroTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

export interface MacroTargets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
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
  targets: MacroTargets;
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

export interface BodyCompEntry {
  date: string;
  weight_kg: number;
  body_fat_pct: number | null;
  muscle_mass_pct: number | null;
}

export interface WeekSummary {
  start_date: string;
  end_date: string;
  daily_avg: MacroTotals;
  micronutrient_avg: MicronutrientAverages;
  weight: WeightDelta;
  body_comp: BodyCompEntry[];
}

export interface StatsSummary {
  weight_history: BodyCompEntry[];
  daily_calories: { date: string; kcal: number }[];
  macro_avg: MacroTotals;
  days_logged: number;
  total_days: number;
  supplement_adherence_pct: number;
  highest_protein_day: { date: string; protein: number } | null;
  lowest_calorie_day: { date: string; kcal: number } | null;
  current_streak: number;
}

export interface WeightEntry {
  date: string;
  weight_kg: number;
  body_fat_pct: number | null;
}

// Settings types

export interface NutritionTargets {
  target_kcal: number;
  target_protein_g: number;
  target_carbs_g: number;
  target_fat_g: number;
  target_fiber_g: number;
  target_sugar_g: number;
  target_sodium_mg: number;
}

export interface MicronutrientTargetItem {
  nutrient: string;
  target_value: number;
  unit: string;
}

export interface SupplementDefinition {
  id: string;
  name: string;
  dose_amount: number;
  dose_unit: string;
  time_of_day: string | null;
  active: boolean;
  micronutrients: Record<string, number> | null;
}

export interface UserSettings {
  nutrition_targets: NutritionTargets;
  micronutrient_targets: MicronutrientTargetItem[];
  supplement_definitions: SupplementDefinition[];
  api_key_masked: string;
}
