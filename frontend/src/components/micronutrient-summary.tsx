"use client";

import type { MicronutrientAverages, MicronutrientTargetItem } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";

/* ── Color constants ── */
const COLOR_SUCCESS = "#4ade80";
const COLOR_WARNING = "#f9c74f";
const COLOR_DANGER  = "#f94f4f";
const COLOR_BAR_BG  = "#1f1f23";

function getProgressColor(pct: number): string {
  if (pct >= 80) return COLOR_SUCCESS;
  if (pct >= 40) return COLOR_WARNING;
  return COLOR_DANGER;
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
    <DashboardCard title="Micronutrient Averages">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {NUTRIENT_MAP.map((n) => {
          const value = microAvg[n.key];
          const userTarget = microTargets.find((t) => t.nutrient === n.settingsKey);
          const target = userTarget?.target_value ?? n.defaultTarget;
          const unit = userTarget?.unit ?? n.defaultUnit;
          const displayVal = value != null ? Math.round(value * 10) / 10 : "\u2014";
          const pct = value != null ? Math.min((value / target) * 100, 100) : 0;

          return (
            <div key={n.key} className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{n.label}</p>
              <p className="text-lg font-bold tabular-nums text-foreground">
                {displayVal}
                <span className="text-xs font-normal text-muted-foreground ml-0.5">/ {target} {unit}</span>
              </p>
              <div
                className="h-1.5 w-full rounded-full overflow-hidden mt-1.5"
                style={{ backgroundColor: COLOR_BAR_BG }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: getProgressColor(pct),
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </DashboardCard>
  );
}
