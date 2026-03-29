"use client";

import type { MicronutrientAverages, MicronutrientTargetItem } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";

function getProgressGradient(pct: number): string {
  if (pct >= 80) return "linear-gradient(90deg, #22c55e, #4ade80)";
  if (pct >= 40) return "linear-gradient(90deg, #f59e0b, #fbbf24)";
  return "linear-gradient(90deg, #ef4444, #f87171)";
}

function getProgressColor(pct: number): string {
  if (pct >= 80) return "#4ade80";
  if (pct >= 40) return "#fbbf24";
  return "#f87171";
}

// Map between API field names and settings nutrient keys
const NUTRIENT_MAP: { key: keyof MicronutrientAverages; settingsKey: string; label: string; defaultTarget: number; defaultUnit: string }[] = [
  { key: "vit_d", settingsKey: "vitamin_d", label: "Vitamin D", defaultTarget: 20, defaultUnit: "\u00b5g" },
  { key: "zinc", settingsKey: "zinc", label: "Zinc", defaultTarget: 10, defaultUnit: "mg" },
  { key: "omega3", settingsKey: "omega3", label: "Omega-3", defaultTarget: 1000, defaultUnit: "mg" },
  { key: "magnesium", settingsKey: "magnesium", label: "Magnesium", defaultTarget: 400, defaultUnit: "mg" },
  { key: "b12", settingsKey: "b12", label: "B12", defaultTarget: 2.4, defaultUnit: "\u00b5g" },
  { key: "iron", settingsKey: "iron", label: "Iron", defaultTarget: 8, defaultUnit: "mg" },
];

interface Props {
  microAvg: MicronutrientAverages;
  microTargets?: MicronutrientTargetItem[];
}

export function MicronutrientSummaryCard({ microAvg, microTargets = [] }: Props) {
  return (
    <DashboardCard title="Micronutrient Averages" span="lg:col-span-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {NUTRIENT_MAP.map((n) => {
          const value = microAvg[n.key];
          const userTarget = microTargets.find((t) => t.nutrient === n.settingsKey);
          const target = userTarget?.target_value ?? n.defaultTarget;
          const unit = userTarget?.unit ?? n.defaultUnit;
          const displayVal = value != null ? Math.round(value * 10) / 10 : "\u2014";
          const pct = value != null ? Math.min((value / target) * 100, 100) : 0;
          const pctRounded = Math.round(pct);

          return (
            <div key={n.key} className="pill p-4 rounded-xl">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">{n.label}</p>
              <p className="text-xl font-bold tabular-nums text-foreground">
                {displayVal}
                <span className="text-xs font-normal text-muted-foreground ml-0.5">/ {target} {unit}</span>
              </p>
              <div className="flex items-center gap-2 mt-2">
                <div className="h-2 flex-1 rounded-full overflow-hidden bg-muted/60">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${pct}%`,
                      background: getProgressGradient(pct),
                    }}
                  />
                </div>
                <span
                  className="text-[11px] font-semibold tabular-nums min-w-[32px] text-right"
                  style={{ color: getProgressColor(pct) }}
                >
                  {pctRounded}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </DashboardCard>
  );
}
