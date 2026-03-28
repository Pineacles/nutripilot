"use client";

import type { MacroTotals } from "@/lib/types";

interface Props {
  dailyAvg: MacroTotals;
}

export function MacroAverages({ dailyAvg }: Props) {
  const macros = [
    { label: "Avg Calories", value: Math.round(dailyAvg.kcal), unit: "kcal", color: "#e8e8e8" },
    { label: "Avg Protein", value: Math.round(dailyAvg.protein), unit: "g", color: "#4f9cf9" },
    { label: "Avg Carbs", value: Math.round(dailyAvg.carbs), unit: "g", color: "#f9c74f" },
    { label: "Avg Fat", value: Math.round(dailyAvg.fat), unit: "g", color: "#f94f4f" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {macros.map((m) => (
        <div
          key={m.label}
          className="rounded-xl border border-[#2a2a30] bg-[#1a1a1f] p-4 transition-all hover:border-[#3a3a40]"
        >
          <p className="text-xs text-[#888] mb-1">{m.label}</p>
          <p className="text-xl font-bold tabular-nums" style={{ color: m.color }}>
            {m.value}
            <span className="text-sm font-normal text-[#888] ml-0.5">{m.unit}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
