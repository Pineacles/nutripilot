/** Rolling-average helper and the shared chart look for the Body page and the weekly body card. */
import { useSyncExternalStore } from "react";
import { rnd } from "@/lib/utils";

type DataRow = Record<string, unknown>;

/**
 * Average of `key` over the `window` calendar days ending at each row (rows sorted by `date`).
 * Counted in days, not rows: with a scale every few weeks, a row count would average months
 * of weigh-ins and pull the line away from where you are now.
 */
export function rollingAvg<T extends DataRow>(data: T[], key: string, window: number = 7): (T & DataRow)[] {
  const DAY = 86_400_000;
  const time = (x: T) => Date.parse(String(x.date));
  return data.map((d, i) => {
    const end = time(d);
    const slice = data
      .slice(0, i + 1)
      .filter(x => x[key] != null && (Number.isNaN(end) || end - time(x) < window * DAY));
    const avg = slice.length > 0 ? slice.reduce((sum: number, x: T) => sum + (x[key] as number), 0) / slice.length : null;
    return { ...d, [`${key}_avg`]: avg != null ? rnd(avg, 1) : null };
  });
}

/* Chart look in the poster world: marks in ink, hairline guides on the ramp, nothing else. */
export const BODY_INK = "var(--ink)";
export const BODY_SOFT = "var(--g5)";
export const BODY_QUIET = "var(--g4)";
export const BODY_RULE = "var(--g2)";
export const BODY_TICK = { fill: "var(--g4)", fontSize: 12 } as const;

/** Flat tooltip: g1 fill, g2 edge, no shadow. */
export const BODY_TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: "var(--g1)",
  border: "1px solid var(--g2)",
  color: "var(--ink)",
  padding: "8px 12px",
  borderRadius: 10,
  fontSize: 12,
};

const subscribeMotion = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** True when the visitor asked for less motion: charts then skip their draw animation. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/** Raw dots draw only for short series: past this many points they bead into a thick line. */
export const MAX_DOT_POINTS = 30;

/**
 * A Y domain on nice ticks that holds every finite value (raw readings, averages, goal) with a
 * little padding. Returns undefined when there is nothing to plot.
 */
export function niceDomain(values: (number | null | undefined)[]): { domain: [number, number]; ticks: number[] } | undefined {
  const v = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (v.length === 0) return undefined;
  let lo = Math.min(...v);
  let hi = Math.max(...v);
  if (hi - lo < 1e-9) { lo -= 0.5; hi += 0.5; }
  const pad = (hi - lo) * 0.06;
  lo -= pad;
  hi += pad;
  const rough = (hi - lo) / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.floor(lo / step + 1e-9) * step;
  const end = Math.ceil(hi / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let t = start; t <= end + step / 2; t += step) ticks.push(Math.round(t / step) * step);
  return { domain: [ticks[0], ticks[ticks.length - 1]], ticks };
}
