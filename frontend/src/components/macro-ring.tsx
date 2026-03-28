"use client";

import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
} from "recharts";
import type { MacroTotals } from "@/lib/types";

interface Props {
  totals: MacroTotals;
  targets: MacroTotals;
}

export function MacroRing({ totals, targets }: Props) {
  const remaining = Math.max(0, Math.round(targets.kcal - totals.kcal));
  const data = [
    {
      name: "Fat",
      value: Math.min((totals.fat / targets.fat) * 100, 100),
      fill: "#f94f4f",
    },
    {
      name: "Carbs",
      value: Math.min((totals.carbs / targets.carbs) * 100, 100),
      fill: "#f9c74f",
    },
    {
      name: "Protein",
      value: Math.min((totals.protein / targets.protein) * 100, 100),
      fill: "#4f9cf9",
    },
  ];

  return (
    <div className="relative h-[220px] w-[220px] mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="40%"
          outerRadius="90%"
          barSize={14}
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <RadialBar
            dataKey="value"
            cornerRadius={10}
            background={{ fill: "#1a1a1f" }}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums">{remaining}</span>
        <span className="text-xs text-[#888]">kcal left</span>
      </div>
    </div>
  );
}

export function MacroLegend({ totals, targets }: Props) {
  const macros = [
    { label: "Protein", value: totals.protein, target: targets.protein, color: "#4f9cf9", unit: "g" },
    { label: "Carbs", value: totals.carbs, target: targets.carbs, color: "#f9c74f", unit: "g" },
    { label: "Fat", value: totals.fat, target: targets.fat, color: "#f94f4f", unit: "g" },
  ];

  return (
    <div className="flex justify-center gap-6 mt-4">
      {macros.map((m) => (
        <div key={m.label} className="text-center">
          <div className="flex items-center gap-1.5 justify-center">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
            <span className="text-xs text-[#888]">{m.label}</span>
          </div>
          <p className="text-sm font-semibold tabular-nums">
            {Math.round(m.value)}<span className="text-[#888] font-normal">/{Math.round(m.target)}{m.unit}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
