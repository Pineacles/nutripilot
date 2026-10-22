import type { LogUnit } from "@/lib/types";

/** Grams eaten for an amount typed in grams or servings. */
export function toGrams(amount: number, unit: LogUnit, servingSizeG?: number | null): number {
  return unit === "serving" && servingSizeG ? amount * servingSizeG : amount;
}

const round = (n: number, step: number) => Math.round(n / step) * step;

/** The same portion in the other unit (servings to 0.01, whole grams), so toggling back and forth doesn't drift. */
export function convertAmount(amount: number, from: LogUnit, to: LogUnit, servingSizeG?: number | null): number {
  if (from === to || !servingSizeG || !Number.isFinite(amount)) return amount;
  if (to === "serving") return Math.max(0.1, round(amount / servingSizeG, 0.01));
  return Math.max(1, Math.round(amount * servingSizeG));
}

/** The amount a fresh entry starts at: one serving when the food has one, else 100 g. */
export function defaultPortion(servingSizeG?: number | null): { amount: number; unit: LogUnit } {
  return servingSizeG ? { amount: 1, unit: "serving" } : { amount: 100, unit: "g" };
}

// Whole grams (one decimal for tiny amounts like spices), servings to two decimals at most.
const fmtGrams = (g: number) => String(g < 10 ? Math.round(g * 10) / 10 : Math.round(g));
const fmtServings = (n: number) => String(Math.round(n * 100) / 100);

/** "1.5 servings · 75 g" or "120 g", for showing an entry back the way it was logged. */
export function formatPortion(amount: number | null | undefined, unit: LogUnit | null | undefined, grams: number): string {
  if (unit === "serving" && amount != null) {
    return `${fmtServings(amount)} ${amount === 1 ? "serving" : "servings"} · ${fmtGrams(grams)} g`;
  }
  return `${fmtGrams(grams)} g`;
}

/**
 * Soft label check: calories should roughly match 4 kcal/g protein and carbs, 9 fat, 7 alcohol.
 * Fiber is counted at 2 kcal/g in EU labels, so allow some room. Returns the estimate when it is
 * more than 20% (and 15 kcal) off, otherwise null.
 */
export function atwaterMismatch(n: { kcal?: number | null; protein?: number | null; carbs?: number | null; fat?: number | null; alcohol?: number | null }): number | null {
  if (n.kcal == null || n.protein == null || n.carbs == null || n.fat == null) return null;
  const estimate = 4 * n.protein + 4 * n.carbs + 9 * n.fat + 7 * (n.alcohol ?? 0);
  const diff = Math.abs(estimate - n.kcal);
  return diff > 15 && diff > 0.2 * Math.max(n.kcal, estimate) ? Math.round(estimate) : null;
}
