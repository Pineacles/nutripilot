import type { LogUnit, Serving } from "@/lib/types";

/**
 * A unit an amount can be typed in. key is "g", "serving" (the food's own serving size) or the id of
 * one of the user's named servings; grams is how much one unit weighs.
 */
export interface PortionUnit {
  key: string;
  /** Short chip label: "Servings", "Grams", or the serving's own name. */
  label: string;
  grams: number;
  /** For named servings: the stored name ("slice"). */
  name?: string;
}

/** The units a food can be logged in: its own serving size, the user's named servings, then grams. */
export function portionUnits(food: { serving_size_g?: number | null; servings?: Serving[] | null } | null | undefined): PortionUnit[] {
  const units: PortionUnit[] = [];
  if (food?.serving_size_g) units.push({ key: "serving", label: "Servings", grams: food.serving_size_g });
  for (const s of food?.servings ?? []) units.push({ key: s.id, label: s.label, grams: s.grams, name: s.label });
  units.push({ key: "g", label: "Grams", grams: 1 });
  return units;
}

/** The unit key an existing entry (or last time's entry) was typed in, when that unit still exists. */
export function unitKeyFor(units: PortionUnit[], unit: LogUnit | null | undefined, label: string | null | undefined): string {
  if (unit !== "serving") return "g";
  const key = label ? units.find((u) => u.name?.toLowerCase() === label.toLowerCase())?.key : "serving";
  return key && units.some((u) => u.key === key) ? key : "g";
}

const round = (n: number, step: number) => Number((Math.round(n / step) * step).toFixed(2));

/** The same portion in another unit (servings to 0.01, grams whole or to 0.1 under 10 g), so toggling doesn't drift. */
export function convertAmount(amount: number, from: PortionUnit, to: PortionUnit): number {
  if (from.key === to.key || !Number.isFinite(amount)) return amount;
  const grams = amount * from.grams;
  if (to.key === "g") return grams < 10 ? Math.max(0.1, round(grams, 0.1)) : Math.round(grams);
  return Math.max(0.1, round(grams / to.grams, 0.01));
}

/** The amount a fresh entry starts at: one serving when the food has one, else 100 g. */
export function defaultPortion(servingSizeG?: number | null): { amount: number; unitKey: string } {
  return servingSizeG ? { amount: 1, unitKey: "serving" } : { amount: 100, unitKey: "g" };
}

/** The request fields for an amount in a unit: grams, servings, or servings of a named serving. */
export function portionPayload(amount: number, unit: PortionUnit): { quantity_g: number } | { servings: number; serving_id?: string } {
  if (unit.key === "g") return { quantity_g: amount };
  return unit.key === "serving" ? { servings: amount } : { servings: amount, serving_id: unit.key };
}

// Whole grams (one decimal for tiny amounts like spices), servings to two decimals at most.
export const fmtGrams = (g: number) => String(g < 10 ? Math.round(g * 10) / 10 : Math.round(g));
const fmtServings = (n: number) => String(Math.round(n * 100) / 100);

/** "1.5 servings · 75 g", "2 × slice · 60 g" or "120 g", for showing an entry back the way it was logged. */
export function formatPortion(amount: number | null | undefined, unit: LogUnit | null | undefined, grams: number, label?: string | null): string {
  if (unit === "serving" && amount != null) {
    if (label) return `${fmtServings(amount)} × ${label} · ${fmtGrams(grams)} g`;
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

/**
 * Other soft label checks: a part bigger than its whole (sugar over carbs, saturated over total fat),
 * or more grams of something than the 100 g it is in, which usually means a wrong serving size.
 * Values are per 100 g. Returns a sentence to show, or null.
 */
export function labelProblem(n: { protein?: number | null; carbs?: number | null; sugar?: number | null; fat?: number | null; sat_fat?: number | null; fiber?: number | null }): string | null {
  if (n.sugar != null && n.carbs != null && n.sugar > n.carbs + 0.5) return "Sugar is more than total carbs. It is part of the carbs, so check both numbers.";
  if (n.sat_fat != null && n.fat != null && n.sat_fat > n.fat + 0.5) return "Saturated fat is more than total fat. It is part of the fat, so check both numbers.";
  const main = (n.protein ?? 0) + (n.carbs ?? 0) + (n.fat ?? 0);
  if (main > 105) return `Protein, carbs and fat come to ${Math.round(main)} g per 100 g, more than the food weighs. Check the serving size and the label.`;
  return null;
}
