import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Round a number to n decimal places (default 1). Avoids floating point noise like 17.0999999994 */
export function fmt(value: number | null | undefined, decimals: number = 1): string {
  if (value == null) return "--";
  return Number(value.toFixed(decimals)).toString();
}

/** Round to n decimals, return number (for calculations). */
export function rnd(value: number, decimals: number = 1): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
