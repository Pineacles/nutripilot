"use client";

import { SectionCard, SectionEmpty } from "@/components/charts/section-card";
import { TrendChart, type TargetMode } from "./trend-chart";
import { type DailyNutritionLike, countDays, daysWord, meanOf } from "@/lib/chart-utils";
import { useTracked } from "@/hooks/use-tracked";

interface Props {
  title: string;
  dataKey: "fiber" | "sugar" | "sodium" | "alcohol";
  unit: string;
  target: number;
  /** Fiber/sugar/sodium always render their reference line; alcohol only when a target is set. */
  showReferenceLine?: boolean;
  nutritionLength: number;
  rollingNutrition: (DailyNutritionLike & Record<string, number>)[];
}

/** Fiber is reached; the others are limits, where a day past the target is --alert and said in the word "over". */
const IS_LIMIT: Record<Props["dataKey"], boolean> = { fiber: false, sugar: true, sodium: true, alcohol: true };

/** The answer in the title: fiber says how many days reached it, a limit how many days broke it. */
function answer(title: string, dataKey: Props["dataKey"], target: number, values: number[]): string {
  if (values.length === 0) return title;
  if (target <= 0) {
    const { n, total } = countDays(values, (v) => v > 0);
    return n === 0 ? `${title}: none in ${daysWord(total)}` : `${title}: on ${n} of ${total} days`;
  }
  if (IS_LIMIT[dataKey]) {
    const { n } = countDays(values, (v) => v > target);
    return n === 0 ? `${title}: never over the limit` : `${title}: over the limit on ${daysWord(n)}`;
  }
  const { n, total } = countDays(values, (v) => v >= target);
  return `${title}: hit ${target.toLocaleString("en-US")} g on ${n} of ${total} days`;
}

/** Small single-metric trend chart shared by Fiber, Sugar, Sodium and Alcohol. Fiber wears its plate; the rest are ink. */
export function NutrientTrendCard({ title, dataKey, unit, target, showReferenceLine = true, nutritionLength, rollingNutrition }: Props) {
  const { shows } = useTracked();
  if (!shows(dataKey)) return null;
  const logged = rollingNutrition.filter((d) => d.kcal > 0);
  const values = logged.map((d) => Number(d[dataKey]) || 0);
  const avg = meanOf(rollingNutrition.map((d) => Number(d[dataKey])));
  const none = nutritionLength > 0 && rollingNutrition.every((d) => !Number(d[dataKey]));
  const mode: TargetMode = !showReferenceLine ? "none" : IS_LIMIT[dataKey] ? "limit" : "goal";
  return (
    <SectionCard
      title={none ? title : answer(title, dataKey, showReferenceLine ? target : 0, values)}
      summary={avg != null ? `avg ${Math.round(avg).toLocaleString("en-US")} ${unit}` : undefined}
    >
      {nutritionLength === 0 ? (
        <SectionEmpty>Nothing logged in this period.</SectionEmpty>
      ) : none ? (
        <p className="border-y border-g2 py-3 text-[13px] text-g4">No {title.toLowerCase()} in this period</p>
      ) : (
        <TrendChart data={rollingNutrition} rawKey={dataKey} avgKey={`avg_${dataKey}`} plate={dataKey} unit={unit} target={target} mode={mode} yWidth={36} />
      )}
    </SectionCard>
  );
}
