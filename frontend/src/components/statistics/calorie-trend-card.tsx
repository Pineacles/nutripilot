"use client";

import { SectionCard, SectionEmpty } from "@/components/charts/section-card";
import { TrendChart } from "./trend-chart";
import { countDays, daysWord, type DailyNutritionLike } from "@/lib/chart-utils";

interface Props {
  nutritionLength: number;
  rollingNutrition: (DailyNutritionLike & Record<string, number>)[];
  targetKcal: number;
}

/** Calories are ink (no plate); days over the target turn --alert and the title says how many. */
export function CalorieTrendCard({ nutritionLength, rollingNutrition, targetKcal }: Props) {
  const { n, total } = countDays(rollingNutrition.filter((d) => d.kcal > 0).map((d) => d.kcal), (v) => v > targetKcal);
  const title = total === 0 ? "Calories" : n === 0 ? "Calories: never over target" : `Calories: over target on ${daysWord(n)} of ${total}`;
  return (
    <SectionCard title={title} span="md:col-span-2" summary={`7-day average, target ${targetKcal.toLocaleString("en-US")}`}>
      {nutritionLength === 0 ? (
        <SectionEmpty>No calories logged in this period.</SectionEmpty>
      ) : (
        <TrendChart data={rollingNutrition} rawKey="kcal" avgKey="avg_kcal" plate="kcal" unit="kcal" target={targetKcal} mode="range" height={240} />
      )}
    </SectionCard>
  );
}
