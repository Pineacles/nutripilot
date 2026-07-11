"use client";

import type { MacroTotals, NutritionTargets } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";

/* ── Color constants matching globals.css tokens ── */
const COLOR_PROTEIN = "#4ade80";
const COLOR_CARBS = "#4f9cf9";
const COLOR_FAT = "#f9c74f";

interface Props {
  dailyAvg: MacroTotals;
  targets?: NutritionTargets | null;
}

export function MacroAveragesCard({ dailyAvg, targets }: Props) {
  const targetProtein = targets?.target_protein_g ?? 150;
  const targetCarbs = targets?.target_carbs_g ?? 250;
  const targetFat = targets?.target_fat_g ?? 70;

  const macros = [
    { label: "Avg Protein", value: Math.round(dailyAvg.protein), unit: "g", color: COLOR_PROTEIN, pill: "pill-green", target: targetProtein },
    { label: "Avg Carbs", value: Math.round(dailyAvg.carbs), unit: "g", color: COLOR_CARBS, pill: "pill-blue", target: targetCarbs },
    { label: "Avg Fat", value: Math.round(dailyAvg.fat), unit: "g", color: COLOR_FAT, pill: "pill-amber", target: targetFat },
  ];

  return (
    <DashboardCard title="Weekly Macro Averages">
      <div className="space-y-3">
        {macros.map((m) => {
          const pct = m.target > 0 ? Math.min((m.value / m.target) * 100, 100) : 0;
          return (
            <div key={m.label} className={`${m.pill} py-3 px-4 rounded-xl`}>
              <div className="flex items-baseline justify-between mb-1.5">
                <p className="text-2xl font-bold tabular-nums" style={{ color: m.color }}>
                  {m.value}
                  <span className="text-sm font-normal text-muted-foreground ml-0.5">{m.unit}</span>
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {m.target}{m.unit} target
                </p>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 w-full rounded-full overflow-hidden bg-muted/40">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${m.color}, ${m.color}aa)`,
                  }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{m.label}</p>
            </div>
          );
        })}
      </div>
      <div className="text-center mt-3">
        <p className="text-sm text-muted-foreground tabular-nums">
          Avg daily intake: <span className="font-semibold text-foreground">{Math.round(dailyAvg.kcal)} kcal</span>
        </p>
      </div>
    </DashboardCard>
  );
}
