/** Rolling-average helper used only by the body-composition page's per-metric trend charts. */
import { rnd } from "@/lib/utils";

type DataRow = Record<string, unknown>;

export function rollingAvg<T extends DataRow>(data: T[], key: string, window: number = 7): (T & DataRow)[] {
  return data.map((d, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1).filter(x => x[key] != null);
    const avg = slice.length > 0 ? slice.reduce((sum: number, x: T) => sum + (x[key] as number), 0) / slice.length : null;
    return { ...d, [`${key}_avg`]: avg != null ? rnd(avg, 1) : null };
  });
}
