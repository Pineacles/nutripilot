"use client";

import { SectionCard, SectionEmpty } from "@/components/charts/section-card";
import { TrendChart } from "./trend-chart";
import { countDays, daysWord, meanOf, withRollingAvg } from "@/lib/chart-utils";
import type { DailyCaffeine } from "@/lib/types";
import { useTracked } from "@/hooks/use-tracked";

interface Props {
  dailyCaffeine: DailyCaffeine[] | undefined;
  targetCaffeineMg: number;
}

/** Caffeine wears its plate and has a daily limit: days over it turn --alert and the title counts them. */
export function CaffeineTrendCard({ dailyCaffeine, targetCaffeineMg }: Props) {
  const { shows } = useTracked();
  if (!shows("caffeine")) return null;
  const has = !!dailyCaffeine && dailyCaffeine.length > 0;
  const rolling = has ? withRollingAvg(dailyCaffeine, "total_mg") : [];
  const avg = has ? meanOf(dailyCaffeine.map((d) => d.total_mg)) : null;
  const { n } = has ? countDays(dailyCaffeine.map((d) => d.total_mg), (v) => v > targetCaffeineMg) : { n: 0 };
  const title = !has ? "Caffeine" : n === 0 ? "Caffeine: never over the limit" : `Caffeine: over the limit on ${daysWord(n)}`;
  return (
    <SectionCard title={title} summary={avg != null ? `avg ${Math.round(avg)} mg, limit ${targetCaffeineMg}` : undefined}>
      {!has ? (
        <SectionEmpty>No caffeine logged in this period.</SectionEmpty>
      ) : (
        <TrendChart data={rolling} rawKey="total_mg" avgKey="avg_total_mg" plate="caffeine" unit="mg" target={targetCaffeineMg} mode="limit" />
      )}
    </SectionCard>
  );
}
