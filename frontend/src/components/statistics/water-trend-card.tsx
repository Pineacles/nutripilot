"use client";

import { SectionCard, SectionEmpty } from "@/components/charts/section-card";
import { TrendChart } from "./trend-chart";
import { countDays, daysWord, meanOf, withRollingAvg } from "@/lib/chart-utils";
import type { DailyWater } from "@/lib/types";
import { useTracked } from "@/hooks/use-tracked";

interface Props {
  dailyWater: DailyWater[] | undefined;
  targetWaterMl: number;
}

/** Water wears its plate; the zone is the target plus or minus 10%, and the title counts the days under it. */
export function WaterTrendCard({ dailyWater, targetWaterMl }: Props) {
  const { shows } = useTracked();
  if (!shows("water")) return null;
  const has = !!dailyWater && dailyWater.length > 0;
  const rolling = has ? withRollingAvg(dailyWater, "total_ml") : [];
  const avg = has ? meanOf(dailyWater.map((d) => d.total_ml)) : null;
  const { n, total } = has ? countDays(dailyWater.map((d) => d.total_ml), (v) => v < targetWaterMl) : { n: 0, total: 0 };
  const title = !has ? "Water" : n === 0 ? "Water: target reached every day" : `Water: under target on ${daysWord(n)} of ${total}`;
  return (
    <SectionCard title={title} summary={avg != null ? `avg ${Math.round(avg).toLocaleString("en-US")} ml, target ${targetWaterMl.toLocaleString("en-US")}` : undefined}>
      {!has ? (
        <SectionEmpty>No water logged in this period.</SectionEmpty>
      ) : (
        <TrendChart data={rolling} rawKey="total_ml" avgKey="avg_total_ml" plate="water" unit="ml" target={targetWaterMl} mode="goal" />
      )}
    </SectionCard>
  );
}
