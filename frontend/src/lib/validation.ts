/**
 * Client-side numeric bounds mirroring backend/app/schemas/settings.py
 * (NutritionTargetsUpdate). Kept in sync manually — read-only on the backend.
 */
export interface NumberConstraint {
  min: number;
  max: number;
}

export const NUTRITION_TARGET_BOUNDS: Record<string, NumberConstraint> = {
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
};

/** Returns an inline error message when `value` violates the bound, or null when valid. */
export function validateBounds(value: number, bounds: NumberConstraint): string | null {
  if (Number.isNaN(value)) return "Enter a number";
  if (value < bounds.min) return `Must be at least ${bounds.min}`;
  if (value > bounds.max) return `Must be at most ${bounds.max}`;
  return null;
}
