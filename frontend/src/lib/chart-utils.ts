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

export function computeAxisInterval(dataLength: number): number {
  if (dataLength <= 14) return 0;
  if (dataLength <= 30) return 2;
  if (dataLength <= 90) return 6;
  return 13;
}

export function nthTickFormatter(data: { date: string }[], maxLabels = 8) {
  const interval = Math.max(1, Math.floor(data.length / maxLabels));
  return (_value: string, index: number) => {
    if (index % interval !== 0) return "";
    return fmtDate(data[index]?.date ?? _value);
  };
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
