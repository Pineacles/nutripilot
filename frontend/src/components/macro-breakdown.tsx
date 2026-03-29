"use client";

import type { MacroTotals, MacroTargets } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";

interface Props {
  totals: MacroTotals;
  targets: MacroTargets;
  span?: string;
}

// mode: "fill" = more is better (green when hitting target)
// mode: "budget" = less is better (warns when approaching/exceeding limit)
const allMacros = [
  { key: "protein" as const, label: "Protein", gradient: "linear-gradient(90deg, #22c55e, #4ade80)", unit: "g", mode: "fill" as const },
  { key: "carbs" as const, label: "Carbs", gradient: "linear-gradient(90deg, #3b82f6, #60a5fa)", unit: "g", mode: "fill" as const },
  { key: "fat" as const, label: "Fat", gradient: "linear-gradient(90deg, #f59e0b, #fbbf24)", unit: "g", mode: "fill" as const },
  { key: "fiber" as const, label: "Fiber", gradient: "linear-gradient(90deg, #84cc16, #a3e635)", unit: "g", mode: "fill" as const },
  { key: "sugar" as const, label: "Sugar", gradient: "linear-gradient(90deg, #ec4899, #f472b6)", unit: "g", mode: "budget" as const },
  { key: "sodium" as const, label: "Sodium", gradient: "linear-gradient(90deg, #a78bfa, #c4b5fd)", unit: "mg", mode: "budget" as const },
];

export function MacroBreakdownCard({ totals, targets, span }: Props) {
  return (
    <DashboardCard title="Macros" span={span}>
      <div className="flex flex-col gap-3 flex-1 justify-center">
        {allMacros.map((m) => {
          const current = Math.round(totals[m.key]);
          const target = Math.round(targets[m.key]);
          const rawPct = target > 0 ? (totals[m.key] / target) * 100 : 0;
          const barPct = Math.min(rawPct, 100);

          // For budget items, bar turns red when over
          let barGradient = m.gradient;
          if (m.mode === "budget" && rawPct > 100) barGradient = "linear-gradient(90deg, #ef4444, #f87171)";
          else if (m.mode === "budget" && rawPct > 80) barGradient = "linear-gradient(90deg, #f59e0b, #fbbf24)";

          const isOver = m.mode === "budget" && rawPct > 100;

          return (
            <div key={m.key} className="group rounded-xl px-3 py-2 -mx-2 transition-all duration-200 hover:bg-muted/40 hover:translate-x-0.5">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors duration-150">{m.label}</span>
                <span className="text-sm tabular-nums text-foreground">
                  <span className={`font-semibold ${isOver ? "text-destructive" : ""}`}>
                    {current}{m.unit}
                  </span>
                  <span className="text-muted-foreground/50"> / {target}{m.unit}</span>
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted/60 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${barPct}%`, background: barGradient }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </DashboardCard>
  );
}
