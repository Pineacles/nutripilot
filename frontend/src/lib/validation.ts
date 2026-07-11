/**
 * Client-side numeric bounds mirroring backend/app/schemas/settings.py
 * (NutritionTargetsUpdate). Kept in sync manually — read-only on the backend.
 */
export interface NumberConstraint {
  min: number;
  max: number;
}

export const NUTRITION_TARGET_BOUNDS = {
  target_kcal: { min: 1, max: 10000 },
  target_protein_g: { min: 0, max: 1000 },
  target_carbs_g: { min: 0, max: 1000 },
  target_fat_g: { min: 0, max: 500 },
  target_fiber_g: { min: 0, max: 200 },
  target_sugar_g: { min: 0, max: 500 },
  target_sodium_mg: { min: 0, max: 10000 },
  target_alcohol_g: { min: 0, max: 500 },
  target_water_ml: { min: 0, max: 20000 },
  target_caffeine_mg: { min: 0, max: 5000 },
} satisfies Record<string, NumberConstraint>;

/** Returns an inline error message when `value` violates the bound, or null when valid. */
export function validateBounds(value: number, bounds: NumberConstraint): string | null {
  if (Number.isNaN(value)) return "Enter a number";
  if (value < bounds.min) return `Must be at least ${bounds.min}`;
  if (value > bounds.max) return `Must be at most ${bounds.max}`;
  return null;
}

/**
 * Bounds for optional goal fields on NutritionTargetsUpdate
 * (target_weight_kg, target_body_fat_pct) — nullable, so callers should skip
 * validation entirely when the field is empty/null.
 */
export const GOAL_BOUNDS = {
  target_weight_kg: { min: 1, max: 500 } as NumberConstraint,
  target_body_fat_pct: { min: 0, max: 100 } as NumberConstraint,
};

/** Bounds mirroring backend/app/schemas/weight_log.py (WeightLogCreate/Update). */
export const WEIGHT_LOG_BOUNDS: Record<string, NumberConstraint> = {
  weight_kg: { min: 1, max: 500 },
  body_fat_pct: { min: 0, max: 100 },
  muscle_mass_pct: { min: 0, max: 100 },
  body_fat_kg: { min: 0, max: 300 },
  muscle_mass_kg: { min: 0, max: 300 },
};

/** Bounds mirroring backend/app/schemas/water_log.py (WaterLogCreate/Update). */
export const WATER_LOG_BOUNDS: NumberConstraint = { min: 1, max: 10000 };

/** Bounds mirroring backend/app/schemas/food_log.py (FoodLogCreate quantity_g/servings). */
export const FOOD_LOG_BOUNDS = {
  quantity_g: { min: 0.1, max: 10000 } as NumberConstraint,
  servings: { min: 0.1, max: 100 } as NumberConstraint,
};

/** Bounds mirroring backend/app/schemas/supplement.py (SupplementCreate dose_amount). */
export const SUPPLEMENT_DOSE_BOUNDS: NumberConstraint = { min: 0.01, max: 100000 };

/** True when a nutrient value (per-100g, always >= 0) is valid or empty. */
export function validateNonNegative(value: number): string | null {
  if (Number.isNaN(value)) return "Enter a number";
  if (value < 0) return "Must be 0 or more";
  return null;
}
