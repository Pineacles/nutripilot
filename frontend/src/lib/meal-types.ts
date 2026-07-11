import type { MealType } from "@/lib/types";

/** Shared meal-type list/labels — mirrors the Literal in backend/app/schemas/food_log.py. */
export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};
