import type { MealType } from "@/lib/types";

/** Shared meal-type list/labels: mirrors the Literal in backend/app/schemas/food_log.py. */
export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

/** The meal people usually mean at this time of day, for a new entry logged now. */
export function mealForTime(now: Date = new Date()): MealType {
  const h = now.getHours() + now.getMinutes() / 60;
  if (h >= 4 && h < 10.5) return "breakfast";
  if (h >= 11 && h < 14.5) return "lunch";
  if (h >= 17 && h < 21.5) return "dinner";
  return "snack";
}
