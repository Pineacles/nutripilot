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
