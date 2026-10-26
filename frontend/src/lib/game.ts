import type { PrintArea } from "@/lib/game-types";

/** A print wears its area's plate when the area is a nutrient (Plate Rule); everything else prints in ink. */
const AREA_INK: Record<PrintArea, string> = {
  consistency: "var(--ink)",
  // kcal has no plate: it prints in ink like the kcal figure and arc
  calories: "var(--ink)",
  variety: "var(--fiber)",
  protein: "var(--protein)",
  hydration: "var(--water)",
  micros: "var(--ink)",
  body: "var(--ink)",
  kitchen: "var(--ink)",
  supplements: "var(--ink)",
};

export const AREA_LABEL: Record<PrintArea, string> = {
  consistency: "Consistency",
  calories: "Calorie window",
  variety: "Variety",
  protein: "Protein",
  hydration: "Water",
  micros: "Micronutrients",
  body: "Body",
  kitchen: "Kitchen",
  supplements: "Supplements",
};

export const AREA_ORDER: PrintArea[] = ["consistency", "calories", "body", "protein", "variety", "hydration", "micros", "supplements", "kitchen"];

export function areaInk(area: PrintArea | null | undefined): string {
  return area ? AREA_INK[area] : "var(--ink)";
}

/** Day goal key to its plate: protein, water and fiber wear theirs; meals and supplements are ink. */
export function goalInk(key: string): string {
  // calories: kcal has no plate, so ink like the kcal arc
  return key === "protein" ? "var(--protein)" : key === "water" ? "var(--water)" : key === "fiber" ? "var(--fiber)" : "var(--ink)";
}

export const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/** A short buzz on phones that have one. */
export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // No vibration motor or not allowed.
  }
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
