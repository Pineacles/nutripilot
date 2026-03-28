"use client";

import type { MacroTotals } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";

interface Props {
  dailyAvg: MacroTotals;
}

export function MacroAveragesCard({ dailyAvg }: Props) {
  const macros = [
    { label: "Avg Protein", value: Math.round(dailyAvg.protein), unit: "g", color: "#22c55e" },
    { label: "Avg Carbs", value: Math.round(dailyAvg.carbs), unit: "g", color: "#3b82f6" },
    { label: "Avg Fat", value: Math.round(dailyAvg.fat), unit: "g", color: "#f59e0b" },
  ];

  return (
    <DashboardCard title="Weekly Macro Averages">
      <div className="flex items-center justify-around flex-1">
        {macros.map((m) => (
          <div key={m.label} className="text-center">
            <p className="text-3xl font-bold tabular-nums" style={{ color: m.color }}>
              {m.value}
              <span className="text-base font-normal text-white/30 ml-0.5">{m.unit}</span>
            </p>
            <p className="text-[11px] text-white/40 mt-1">{m.label}</p>
          </div>
        ))}
      </div>
      <div className="text-center mt-1">
        <p className="text-sm text-white/50 tabular-nums">
          Avg daily intake: <span className="font-semibold text-white">{Math.round(dailyAvg.kcal)} kcal</span>
        </p>
      </div>
    </DashboardCard>
  );
}
