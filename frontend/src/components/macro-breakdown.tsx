"use client";

import type { MacroTotals } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";

interface Props {
  totals: MacroTotals;
  targets: MacroTotals;
}

const macros = [
  { key: "protein" as const, label: "Protein", color: "#22c55e" },
  { key: "carbs" as const, label: "Carbs", color: "#3b82f6" },
  { key: "fat" as const, label: "Fat", color: "#f59e0b" },
];

export function MacroBreakdownCard({ totals, targets }: Props) {
  return (
    <DashboardCard title="Macros">
      <div className="flex flex-col gap-4 flex-1 justify-center">
        {macros.map((m) => {
          const current = Math.round(totals[m.key]);
          const target = Math.round(targets[m.key]);
          const pct = Math.min((totals[m.key] / targets[m.key]) * 100, 100);
          return (
            <div key={m.key}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-sm text-white/70">{m.label}</span>
                <span className="text-sm tabular-nums text-white">
                  <span className="font-semibold">{current}g</span>
                  <span className="text-white/30"> / {target}g</span>
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-[#1f1f23] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: m.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </DashboardCard>
  );
}
