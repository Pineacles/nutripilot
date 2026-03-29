"use client";

import { DashboardCard } from "./dashboard-card";
import type { TodaySummary } from "@/lib/types";

interface Props {
  data: TodaySummary;
}

export function QuickStatsCard({ data }: Props) {
  // Derive stats from totals — we show fiber, sugar, salt, sat_fat as quick stats
  // These aren't in the summary yet, so show what we have plus placeholders
  const stats = [
    { label: "Meals", value: data.meals.reduce((acc, m) => acc + m.items.length, 0).toString(), unit: "items" },
    { label: "Supplements", value: data.supplements.length.toString(), unit: "taken" },
    { label: "Kcal Left", value: Math.max(0, Math.round(data.targets.kcal - data.totals.kcal)).toString(), unit: "kcal" },
    { label: "Protein %", value: data.totals.kcal > 0 ? Math.round((data.totals.protein * 4 / data.totals.kcal) * 100).toString() : "0", unit: "%" },
  ];

  return (
    <DashboardCard title="Quick Stats">
      <div className="grid grid-cols-2 gap-3 flex-1 content-center">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl bg-muted/40 border border-border p-4 text-center transition-colors duration-150 hover:bg-muted/70"
          >
            <p className="text-3xl font-bold tabular-nums text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}
