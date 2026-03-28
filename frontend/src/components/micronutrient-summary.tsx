"use client";

import type { MicronutrientAverages } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";

interface Props {
  microAvg: MicronutrientAverages;
}

const nutrients = [
  { key: "vit_d" as const, label: "Vitamin D", unit: "µg", target: 20 },
  { key: "zinc" as const, label: "Zinc", unit: "mg", target: 11 },
  { key: "omega3" as const, label: "Omega-3", unit: "mg", target: 250 },
  { key: "magnesium" as const, label: "Magnesium", unit: "mg", target: 400 },
  { key: "b12" as const, label: "B12", unit: "µg", target: 2.4 },
  { key: "iron" as const, label: "Iron", unit: "mg", target: 8 },
];

export function MicronutrientSummaryCard({ microAvg }: Props) {
  return (
    <DashboardCard title="Micronutrient Averages">
      <div className="grid grid-cols-3 gap-3">
        {nutrients.map((n) => {
          const value = microAvg[n.key];
          const displayVal = value != null ? Math.round(value * 10) / 10 : "—";
          const pct = value != null ? Math.min((value / n.target) * 100, 100) : 0;

          return (
            <div key={n.key} className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
              <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">{n.label}</p>
              <p className="text-lg font-bold tabular-nums text-white">
                {displayVal}
                <span className="text-xs font-normal text-white/30 ml-0.5">{n.unit}</span>
              </p>
              <div className="h-1.5 w-full rounded-full bg-[#1f1f23] overflow-hidden mt-1.5">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: pct >= 80 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#ef4444",
                  }}
                />
              </div>
              <p className="text-[9px] text-white/25 mt-1 tabular-nums">
                Target: {n.target} {n.unit}
              </p>
            </div>
          );
        })}
      </div>
    </DashboardCard>
  );
}
