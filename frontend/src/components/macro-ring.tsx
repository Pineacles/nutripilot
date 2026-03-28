"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { MacroTotals } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";

interface Props {
  totals: MacroTotals;
  targets: MacroTotals;
}

export function CalorieRingCard({ totals, targets }: Props) {
  const eaten = Math.round(totals.kcal);
  const remaining = Math.max(0, Math.round(targets.kcal - totals.kcal));
  const pct = Math.min(totals.kcal / targets.kcal, 1);

  const data = [
    { value: pct * 100, fill: "#22c55e" },
    { value: (1 - pct) * 100, fill: "#1f1f23" },
  ];

  return (
    <DashboardCard title="Calories">
      <div className="flex flex-col items-center justify-center flex-1">
        <div className="relative h-[180px] w-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold tabular-nums text-white">{eaten}</span>
            <span className="text-xs text-white/40">/ {Math.round(targets.kcal)} kcal</span>
          </div>
        </div>
        <p className="text-sm text-white/50 mt-2 tabular-nums">
          <span className="text-[#22c55e] font-semibold">{remaining}</span> kcal remaining
        </p>
      </div>
    </DashboardCard>
  );
}
