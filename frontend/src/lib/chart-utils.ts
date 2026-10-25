import { useSyncExternalStore } from "react";

/** Date/axis formatting helpers shared by the statistics and body-composition charts. */

export function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtDateFull(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtDateAxis(dateStr: string, dataLength: number): string {
  const d = new Date(dateStr + "T00:00:00");
  if (dataLength > 90) {
    return d.toLocaleDateString("en-US", { month: "short" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Props that keep date ticks readable at any width: Recharts drops labels that would overlap. */
export const AXIS_TICK_PROPS = { interval: "preserveStartEnd", minTickGap: 24 } as const;

/** Formats the tick value itself (a date string), independent of tick position. */
export function dateTickFormatter() {
  return (value: string) => fmtDate(String(value));
}

export interface DailyNutritionLike {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  alcohol: number;
  date: string;
  [key: string]: unknown;
}

/** 7-day (by default) rolling average for a set of keys, added as `avg_<key>` fields. */
export function computeRollingAvg<T extends DailyNutritionLike>(data: T[], keys: (keyof DailyNutritionLike)[], windowSize: number = 7): (T & Record<string, number>)[] {
  return data.map((d, i) => {
    const start = Math.max(0, i - windowSize + 1);
    const slice = data.slice(start, i + 1);
    const avgs: Record<string, number> = {};
    for (const key of keys) {
      const avg = slice.reduce((sum, x) => sum + (Number(x[key]) || 0), 0) / slice.length;
      avgs[`avg_${String(key)}`] = Math.round(avg);
    }
    return { ...d, ...avgs } as T & Record<string, number>;
  });
}

const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * Props that make a recharts mark draw once, short and eased out, and not at all under reduced
 * motion. Spread onto Line, Area and Bar: `<Line {...useChartMotion()} />`.
 */
export function useChartMotion() {
  const reduced = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => true,
  );
  return { isAnimationActive: !reduced, animationDuration: 700, animationEasing: "ease-out" } as const;
}

/** Today as a local YYYY-MM-DD key, comparable with the API's date strings. */
export function todayKey(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Compact value-axis tick: 1,500 reads 1.5k, 5,000 reads 5k, so four-digit values never clip. */
export function fmtAxisTick(v: number): string {
  if (Math.abs(v) < 1000) return String(Math.round(v * 100) / 100);
  return `${Math.round((v / 1000) * 10) / 10}k`;
}

/**
 * The top of a 0-based value axis: `max` rounded up to a whole step of 1, 2, 2.5 or 5 times a power
 * of ten, so four even intervals give round ticks (460 reads 500, not 459.99999999999994).
 */
export function niceCeil(max: number): number {
  if (!(max > 0)) return 1;
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw - 1e-9) ?? 10 * pow;
  return Math.round(Math.ceil(max / step - 1e-9) * step * 1e6) / 1e6;
}

/** Adds `avg_<key>` (rolling mean over `windowSize` entries, 7 by default) to each row of a daily series. */
export function withRollingAvg<T extends object>(data: T[], key: keyof T & string, windowSize: number = 7): (T & Record<string, number>)[] {
  return data.map((d, i) => {
    const slice = data.slice(Math.max(0, i - windowSize + 1), i + 1);
    const avg = slice.reduce((sum, x) => sum + (Number(x[key]) || 0), 0) / slice.length;
    return { ...d, [`avg_${key}`]: Math.round(avg) } as T & Record<string, number>;
  });
}

/** The hero's gap to target in words: "on target" inside 1% of it, else "51 under" or "+51 over". */
export function gapPhrase(avg: number, target: number): string {
  const gap = Math.round(avg - target);
  if (target > 0 && Math.abs(gap) < target * 0.01) return "on target";
  if (gap === 0) return "on target";
  return gap > 0 ? `+${gap.toLocaleString("en-US")} over` : `${Math.abs(gap).toLocaleString("en-US")} under`;
}

/** Mean of a numeric series, ignoring missing values; null when there is nothing to average. */
export function meanOf(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === "number" && !Number.isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** "1 day" / "9 days". */
export function daysWord(n: number): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? "day" : "days"}`;
}

/** How many of the values pass a test, and how many there are. Rows without a figure are skipped. */
export function countDays(values: (number | null | undefined)[], test: (v: number) => boolean): { n: number; total: number } {
  const v = values.filter((x): x is number => typeof x === "number" && !Number.isNaN(x));
  return { n: v.filter(test).length, total: v.length };
}

/** A figure without needless decimals: 446.1 reads 446, 2.43 reads 2.4 (one decimal only under 10). */
export function fmtFigure(v: number): string {
  if (Math.abs(v) >= 10) return Math.round(v).toLocaleString("en-US");
  return String(Math.round(v * 10) / 10);
}

/** "18 of 90 days", with the singular when the period is one day. */
export function ofDays(n: number, total: number): string {
  return `${n.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} ${total === 1 ? "day" : "days"}`;
}
