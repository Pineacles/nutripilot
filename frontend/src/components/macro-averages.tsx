"use client";

import type { MacroTotals } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";

/* ── Color constants matching globals.css tokens ── */
const COLOR_PROTEIN = "#4ade80";
const COLOR_CARBS   = "#4f9cf9";
const COLOR_FAT     = "#f9c74f";

interface Props {
  dailyAvg: MacroTotals;
}

export function MacroAveragesCard({ dailyAvg }: Props) {
  const macros = [
    { label: "Avg Protein", value: Math.round(dailyAvg.protein), unit: "g", color: COLOR_PROTEIN },
    { label: "Avg Carbs", value: Math.round(dailyAvg.carbs), unit: "g", color: COLOR_CARBS },
    { label: "Avg Fat", value: Math.round(dailyAvg.fat), unit: "g", color: COLOR_FAT },
  ];

  return (
    <DashboardCard title="Weekly Macro Averages">
      <div className="flex items-center justify-around flex-1 gap-2">
        {macros.map((m) => (
          <div
            key={m.label}
            className="flex-1 text-center rounded-xl bg-white/[0.03] border border-white/5 py-3 px-2"
          >
            <p className="text-3xl font-bold tabular-nums" style={{ color: m.color }}>
              {m.value}
              <span className="text-base font-normal text-muted-foreground ml-0.5">{m.unit}</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">{m.label}</p>
          </div>
        ))}
      </div>
      <div className="text-center mt-2">
        <p className="text-sm text-muted-foreground tabular-nums">
          Avg daily intake: <span className="font-semibold text-foreground">{Math.round(dailyAvg.kcal)} kcal</span>
        </p>
      </div>
    </DashboardCard>
  );
}
