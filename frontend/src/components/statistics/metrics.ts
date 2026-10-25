import { countDays, daysWord, ofDays } from "@/lib/chart-utils";
import type { TargetMode } from "./trend-chart";

/** What a scorecard row's status word says: over or low (--alert), high (--alert), on track (g5), or nothing. */
export type RowStatus = "over" | "low" | "high" | "ok" | "none";

export interface Summary {
  answer: string;
  status: RowStatus;
}

/** A goal is "low" when it was hit on fewer than half the days. */
const GOAL_LOW_SHARE = 0.5;
/** A limit or range target is "over" when it was broken on more than a quarter of the days. */
const LIMIT_OVER_SHARE = 0.25;

const fmtN = (v: number) => Math.round(v).toLocaleString("en-US");

/**
 * The answer in words for one metric and its status word. A goal (protein, fiber, water) counts the
 * days it was hit, a limit or range (kcal, carbs, fat, sugar, sodium, caffeine) the days it was
 * broken; with no target it only says on how many days there was any. `noun` is "target" or "limit".
 */
export function summarize(values: number[], target: number, mode: TargetMode, unit: string, noun: "target" | "limit"): Summary {
  const total = values.length;
  if (total === 0) return { answer: "Nothing logged in this period", status: "none" };
  if (mode === "none" || target <= 0) {
    const { n } = countDays(values, (v) => v > 0);
    return { answer: n === 0 ? `none in ${daysWord(total)}` : `on ${ofDays(n, total)}`, status: "none" };
  }
  if (mode === "goal") {
    const { n } = countDays(values, (v) => v >= target);
    const answer = n === total ? `hit ${fmtN(target)} ${unit} every day` : n === 0 ? `never hit ${fmtN(target)} ${unit}` : `hit ${fmtN(target)} ${unit} on ${ofDays(n, total)}`;
    return { answer, status: n / total < GOAL_LOW_SHARE ? "low" : "ok" };
  }
  const { n } = countDays(values, (v) => v > target);
  return {
    answer: n === 0 ? `never over ${noun}` : `over ${noun} on ${ofDays(n, total)}`,
    status: n / total > LIMIT_OVER_SHARE ? "over" : "ok",
  };
}
