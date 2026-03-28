"use client";

import type { MacroTotals, MacroTargets } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";

interface Props {
  totals: MacroTotals;
  targets: MacroTargets;
}

// mode: "fill" = more is better (green when hitting target)
// mode: "budget" = less is better (warns when approaching/exceeding limit)
const allMacros = [
  { key: "protein" as const, label: "Protein", color: "#22c55e", unit: "g", mode: "fill" as const },
  { key: "carbs" as const, label: "Carbs", color: "#3b82f6", unit: "g", mode: "fill" as const },
  { key: "fat" as const, label: "Fat", color: "#f59e0b", unit: "g", mode: "fill" as const },
  { key: "fiber" as const, label: "Fiber", color: "#84cc16", unit: "g", mode: "fill" as const },
  { key: "sugar" as const, label: "Sugar", color: "#ec4899", unit: "g", mode: "budget" as const },
  { key: "sodium" as const, label: "Sodium", color: "#a78bfa", unit: "mg", mode: "budget" as const },
];

export function MacroBreakdownCard({ totals, targets }: Props) {
  return (
    <DashboardCard title="Macros">
      <div className="flex flex-col gap-3 flex-1 justify-center">
        {allMacros.map((m) => {
          const current = Math.round(totals[m.key]);
          const target = Math.round(targets[m.key]);
          const rawPct = target > 0 ? (totals[m.key] / target) * 100 : 0;
          const barPct = Math.min(rawPct, 100);

          // For budget items, bar turns red when over
          let barColor = m.color;
          if (m.mode === "budget" && rawPct > 100) barColor = "#ef4444";
          else if (m.mode === "budget" && rawPct > 80) barColor = "#f59e0b";

          const isOver = m.mode === "budget" && rawPct > 100;

          return (
            <div key={m.key}>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-sm text-white/70">{m.label}</span>
                <span className="text-sm tabular-nums text-white">
                  <span className={`font-semibold ${isOver ? "text-[#ef4444]" : ""}`}>
                    {current}{m.unit}
                  </span>
                  <span className="text-white/30"> / {target}{m.unit}</span>
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#1f1f23] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${barPct}%`, backgroundColor: barColor }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </DashboardCard>
  );
}
