"use client";

import { SectionCard } from "@/components/charts/section-card";
import type { TodaySummary } from "@/lib/types";
import { useTracked } from "@/hooks/use-tracked";

interface Props {
  data: TodaySummary;
}

/** A ruled row of small counts; hidden nutrients drop out and the columns recompute. */
export function QuickStatsCard({ data }: Props) {
  const { shows } = useTracked();
  const stats = [
    { label: "Meals", value: data.meals.filter((m) => m.items.length > 0).length.toString() },
    { label: "Supplements", value: data.supplements.length.toString() },
    ...(shows("fiber") ? [{ label: "Fiber (g)", value: Math.round(data.totals.fiber).toString() }] : []),
    ...(shows("protein") ? [{ label: "Protein %", value: data.totals.kcal > 0 ? Math.round((data.totals.protein * 4 / data.totals.kcal) * 100).toString() : "0" }] : []),
  ];

  return (
    <SectionCard title="Quick stats">
      <dl className="grid divide-x divide-g2" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
        {stats.map((s, i) => (
          <div key={s.label} className={i === 0 ? "pr-3" : "px-3"}>
            <dt className="text-[12px] text-g4">{s.label}</dt>
            <dd className="mt-0.5 text-[22px] font-medium tabular-nums text-ink">{s.value}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}
