// Every nutrient Settings, Tracked nutrients can switch off. Calories always stay: the app is
// built around them. Keys match the backend (app/schemas/settings.py TRACKABLE_NUTRIENTS).

export type NutrientGroup = "Macros" | "Vitamins and minerals" | "Drinks";

export interface Trackable {
  key: string;
  label: string;
  group: NutrientGroup;
}

export const TRACKABLE: Trackable[] = [
  { key: "protein", label: "Protein", group: "Macros" },
  { key: "carbs", label: "Carbs", group: "Macros" },
  { key: "fat", label: "Fat", group: "Macros" },
  { key: "fiber", label: "Fiber", group: "Macros" },
  { key: "sugar", label: "Sugar", group: "Macros" },
  { key: "sat_fat", label: "Saturated fat", group: "Macros" },
  { key: "salt", label: "Salt (sodium)", group: "Macros" },
  { key: "calcium", label: "Calcium", group: "Vitamins and minerals" },
  { key: "potassium", label: "Potassium", group: "Vitamins and minerals" },
  { key: "magnesium", label: "Magnesium", group: "Vitamins and minerals" },
  { key: "iron", label: "Iron", group: "Vitamins and minerals" },
  { key: "zinc", label: "Zinc", group: "Vitamins and minerals" },
  { key: "omega3", label: "Omega-3", group: "Vitamins and minerals" },
  { key: "vit_c", label: "Vitamin C", group: "Vitamins and minerals" },
  { key: "vit_d", label: "Vitamin D", group: "Vitamins and minerals" },
  { key: "vit_k2", label: "Vitamin K2", group: "Vitamins and minerals" },
  { key: "b12", label: "Vitamin B12", group: "Vitamins and minerals" },
  { key: "water", label: "Water", group: "Drinks" },
  { key: "caffeine", label: "Caffeine", group: "Drinks" },
  { key: "alcohol", label: "Alcohol", group: "Drinks" },
];

export const NUTRIENT_GROUPS: NutrientGroup[] = ["Macros", "Vitamins and minerals", "Drinks"];

/** Names the API and older screens use for the same nutrient. */
const ALIASES: Record<string, string> = {
  sodium: "salt",
  sodium_mg: "salt",
  saturated_fat: "sat_fat",
  omega_3: "omega3",
  vitamin_d: "vit_d",
  vitamin_c: "vit_c",
  vitamin_k2: "vit_k2",
  vitamin_b12: "b12",
  water_ml: "water",
  caffeine_mg: "caffeine",
  alcohol_g: "alcohol",
};

export function trackableKey(name: string): string {
  const key = name.toLowerCase();
  return ALIASES[key] ?? key;
}

export const PRESETS: { label: string; hidden: string[] }[] = [
  { label: "Everything", hidden: [] },
  { label: "Macros only", hidden: TRACKABLE.filter((t) => t.group === "Vitamins and minerals").map((t) => t.key) },
  {
    label: "Calories and protein",
    hidden: TRACKABLE.filter((t) => t.key !== "protein").map((t) => t.key),
  },
];
