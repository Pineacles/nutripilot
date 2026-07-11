/** Shared per-100g nutrient label/unit metadata — mirrors backend/app/schemas/food.py NutrientData. */
export const MACRO_NUTRIENT_LABELS: Record<string, { label: string; unit: string }> = {
  kcal: { label: "Calories", unit: "kcal" },
  protein: { label: "Protein", unit: "g" },
  carbs: { label: "Carbs", unit: "g" },
  sugar: { label: "Sugar", unit: "g" },
  fiber: { label: "Fiber", unit: "g" },
  fat: { label: "Fat", unit: "g" },
  sat_fat: { label: "Sat. Fat", unit: "g" },
  salt: { label: "Salt", unit: "g" },
  alcohol: { label: "Alcohol", unit: "g" },
  caffeine_mg: { label: "Caffeine", unit: "mg" },
};

export const MICRO_NUTRIENT_LABELS: Record<string, { label: string; unit: string }> = {
  calcium: { label: "Calcium", unit: "mg" },
  potassium: { label: "Potassium", unit: "mg" },
  omega3: { label: "Omega-3", unit: "mg" },
  zinc: { label: "Zinc", unit: "mg" },
  vit_d: { label: "Vitamin D", unit: "µg" },
  vit_k2: { label: "Vitamin K2", unit: "µg" },
  vit_c: { label: "Vitamin C", unit: "mg" },
  magnesium: { label: "Magnesium", unit: "mg" },
  b12: { label: "Vitamin B12", unit: "µg" },
  iron: { label: "Iron", unit: "mg" },
};

export const NUTRIENT_LABELS: Record<string, { label: string; unit: string }> = {
  ...MACRO_NUTRIENT_LABELS,
  ...MICRO_NUTRIENT_LABELS,
};
