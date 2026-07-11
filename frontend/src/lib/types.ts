export interface MacroTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  alcohol: number;
}

export interface MacroTargets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  alcohol: number;
}

export interface MealItem {
  food_name: string;
  quantity_g: number;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  alcohol: number | null;
  caffeine_mg: number | null;
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
  water: WaterTotals;
  caffeine: CaffeineTotals;
  micronutrients?: MicronutrientAverages | null;
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
  body_fat_kg: number | null;
  muscle_mass_kg: number | null;
  [key: string]: unknown;
}

export interface WeekSummary {
  start_date: string;
  end_date: string;
  daily_avg: MacroTotals;
  daily_calories: { date: string; kcal: number }[];
  micronutrient_avg: MicronutrientAverages;
  weight: WeightDelta;
  body_comp: BodyCompEntry[];
  daily_water: DailyWater[];
  daily_caffeine: DailyCaffeine[];
}

export interface DailyNutrition {
  date: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  alcohol: number;
}

export interface DailyMicros {
  date: string;
  calcium: number | null;
  potassium: number | null;
  omega3: number | null;
  zinc: number | null;
  vit_d: number | null;
  vit_c: number | null;
  magnesium: number | null;
  b12: number | null;
  iron: number | null;
}

export interface SupplementLogEntry {
  date: string;
  count: number;
  names: string[];
}

export interface StatsSummary {
  weight_history: BodyCompEntry[];
  daily_nutrition: DailyNutrition[];
  daily_micros: DailyMicros[];
  supplement_log: SupplementLogEntry[];
  macro_avg: MacroTotals;
  micro_avg: MicronutrientAverages;
  daily_water: DailyWater[];
  daily_caffeine: DailyCaffeine[];
  avg_water_ml: number;
  avg_caffeine_mg: number;
  days_logged: number;
  total_days: number;
  supplement_adherence_pct: number;
  highest_protein_day: { date: string; protein: number } | null;
  lowest_calorie_day: { date: string; kcal: number } | null;
  highest_calorie_day: { date: string; kcal: number } | null;
  best_fiber_day: { date: string; fiber: number } | null;
  avg_daily_kcal: number;
  current_streak: number;
}

export interface WeightEntry {
  date: string;
  weight_kg: number;
  body_fat_pct: number | null;
}

// Foods

export interface FoodListItem {
  id: string | null;
  name: string;
  barcode: string | null;
  source: string;
  kcal: number | null;
  protein: number | null;
}

export interface FoodsSearchPage {
  items: FoodListItem[];
  total: number;
  page: number;
  pages: number;
}

export interface FoodDetail {
  id: string;
  name: string;
  barcode: string | null;
  source: string;
  serving_size_g?: number | null;
  serving_label?: string | null;
  nutrients: Record<string, number | null> | null;
  /** The current user owns this food (can edit/delete it). */
  is_mine?: boolean;
  /** True for is_mine foods; false for official/curated (read-only) foods. */
  editable?: boolean;
}

// Per-100g nutrient fields — mirrors backend/app/schemas/food.py NutrientData
// and backend/app/schemas/food_log.py NutrientsPer100g (same field set).
export interface NutrientData {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  sugar: number | null;
  fiber: number | null;
  fat: number | null;
  sat_fat: number | null;
  salt: number | null;
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
  alcohol: number | null;
  caffeine_mg: number | null;
}

// mirrors backend/app/schemas/food.py FoodCreate / FoodUpdate / FoodClone
export interface FoodCreateInput {
  name: string;
  barcode?: string | null;
  serving_size_g?: number | null;
  serving_label?: string | null;
  nutrients: Partial<NutrientData>;
}

export interface FoodUpdateInput {
  name?: string;
  barcode?: string | null;
  serving_size_g?: number | null;
  serving_label?: string | null;
  nutrients?: Partial<NutrientData>;
}

export interface FoodCloneInput {
  name?: string | null;
}

// Food log CRUD — mirrors backend/app/schemas/food_log.py
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface FoodLogCreateInput {
  food_id: string;
  quantity_g?: number;
  servings?: number;
  meal_type: MealType;
  date?: string;
}

export interface FoodLogByBarcodeCreateInput {
  barcode: string;
  quantity_g?: number;
  servings?: number;
  meal_type: MealType;
  date?: string;
}

export interface FoodLogUpdateInput {
  quantity_g?: number;
  meal_type?: MealType;
  date?: string;
}

/** Response from POST/PUT /api/agent/log/food[-by-barcode]/{id} — mirrors FoodLogResponse. */
export interface FoodLogCreateResponse {
  id: string;
  food_name: string;
  quantity_g: number;
  meal_type: string;
  date: string;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  serving_size_g: number | null;
  serving_label: string | null;
}

/** One entry from GET /api/agent/log/food?day= — mirrors FoodLogDetail. */
export interface FoodLogDetailEntry {
  id: string;
  food_id: string;
  food_name: string;
  food_source: string;
  barcode: string | null;
  serving_size_g: number | null;
  serving_label: string | null;
  quantity_g: number;
  meal_type: string;
  date: string;
  logged_at: string | null;
  nutrients_consumed: NutrientData;
  nutrients_per_100g: NutrientData | null;
}

/** GET /api/agent/log/food?day= — mirrors DailyLogResponse. */
export interface DailyFoodLogResponse {
  date: string;
  total_items: number;
  total_kcal: number;
  entries: FoodLogDetailEntry[];
}

// Weight log CRUD — mirrors backend/app/schemas/weight_log.py
export interface WeightLogRow {
  id: string;
  weight_kg: number;
  body_fat_pct: number | null;
  muscle_mass_pct: number | null;
  body_fat_kg: number | null;
  muscle_mass_kg: number | null;
  source: string;
  date: string;
  created_at?: string | null;
}

export interface WeightLogCreateInput {
  weight_kg: number;
  body_fat_pct?: number | null;
  muscle_mass_pct?: number | null;
  body_fat_kg?: number | null;
  muscle_mass_kg?: number | null;
  source?: string;
  date?: string;
}

export interface WeightLogUpdateInput {
  weight_kg?: number;
  body_fat_pct?: number | null;
  muscle_mass_pct?: number | null;
  body_fat_kg?: number | null;
  muscle_mass_kg?: number | null;
  /** Only allowed when the row's source is 'manual' — synced rows reject this with 422. */
  log_date?: string;
}

// Water log CRUD — mirrors backend/app/schemas/water_log.py
export interface WaterLogRow {
  id: string;
  amount_ml: number;
  date: string;
  logged_at?: string | null;
}

export interface WaterLogCreateInput {
  amount_ml: number;
  date?: string;
}

export interface WaterLogUpdateInput {
  amount_ml?: number;
}

// Supplement intake log CRUD — mirrors backend/app/schemas/supplement.py
// (distinct from SupplementDefinition, which describes what the user takes)
export interface SupplementIntakeLog {
  id: string;
  name: string;
  dose_amount: number;
  dose_unit: string;
  time_of_day: string | null;
  date: string;
}

export interface SupplementLogCreateInput {
  name: string;
  dose_amount: number;
  dose_unit: string;
  time_of_day?: string | null;
  date?: string;
}

export interface SupplementLogUpdateInput {
  name?: string;
  dose_amount?: number;
  dose_unit?: string;
  time_of_day?: string | null;
  date?: string;
}

// Supplement definition update — mirrors backend/app/schemas/settings.py SupplementDefinitionUpdate
export interface SupplementDefinitionUpdateInput {
  name?: string;
  dose_amount?: number;
  dose_unit?: string;
  time_of_day?: string | null;
  active?: boolean;
  micronutrients?: Record<string, number> | null;
}

// Integrations CRUD — mirrors backend/app/schemas/integration.py
export interface IntegrationCreateInput {
  name: string;
  source_url: string;
  auth_header?: string | null;
  schedule?: string;
  field_mapping: Record<string, unknown>;
}

export interface IntegrationUpdateInput {
  name?: string;
  source_url?: string;
  auth_header?: string | null;
  schedule?: string;
  field_mapping?: Record<string, unknown>;
  status?: "active" | "paused" | "error";
}

// Nutrient source drill-down (macro-breakdown / micronutrient-summary "sources" dialogs)

export interface NutrientSourceItem {
  food_name: string;
  amount: number;
  quantity_g: number;
  date: string;
  meal_type: string;
}

export interface NutrientSourcesResponse {
  total: number;
  sources: NutrientSourceItem[];
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
  target_alcohol_g: number;
  target_water_ml: number;
  target_caffeine_mg: number;
  target_weight_kg?: number | null;
  target_body_fat_pct?: number | null;
  timezone?: string | null;
}

export interface WaterTotals {
  total_ml: number;
  target_ml: number;
}

export interface CaffeineTotals {
  total_mg: number;
  target_mg: number;
}

export interface DailyWater {
  date: string;
  total_ml: number;
}

export interface DailyCaffeine {
  date: string;
  total_mg: number;
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

export interface Integration {
  id: string;
  name: string;
  source_url: string;
  schedule: string;
  field_mapping: Record<string, string> | null;
  last_synced_at: string | null;
  status: "active" | "error" | "paused";
  created_at: string;
}
