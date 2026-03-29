"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { MacroTotals, MacroTargets } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";

/* ── Color constants (Recharts needs hex values) ── */
const COLOR_SUCCESS = "#4ade80";
const COLOR_WARNING = "#f9c74f";
const COLOR_DANGER  = "#f94f4f";
const COLOR_RING_BG = "#1f1f23";

interface Props {
  totals: MacroTotals;
  targets: MacroTargets;
}

function getRingColor(pct: number): string {
  if (pct > 1.0) return COLOR_DANGER;   // over target — red
  if (pct > 0.9) return COLOR_WARNING;  // 90-100% — amber
  return COLOR_SUCCESS;                // under 90% — green
}

export function CalorieRingCard({ totals, targets }: Props) {
  const eaten = Math.round(totals.kcal);
  const remaining = Math.max(0, Math.round(targets.kcal - totals.kcal));
  const rawPct = targets.kcal > 0 ? totals.kcal / targets.kcal : 0;
  const pct = Math.min(rawPct, 1);
  const ringColor = getRingColor(rawPct);

  const data = [
    { value: pct * 100, fill: ringColor },
    { value: (1 - pct) * 100, fill: COLOR_RING_BG },
  ];

  return (
    <DashboardCard title="Calories">
      <div className="flex flex-col items-center justify-center flex-1">
        <div
          className="relative h-[180px] w-[180px]"
          style={{ filter: `drop-shadow(0 0 12px ${ringColor}33)` }}
        >
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
            <span className="text-3xl font-extrabold tabular-nums tracking-tight text-foreground">
              {eaten}
            </span>
            <span className="text-xs text-muted-foreground">
              / {Math.round(targets.kcal)} kcal
            </span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2 tabular-nums">
          {rawPct > 1.0 ? (
            <span className="text-destructive font-semibold">{Math.round(totals.kcal - targets.kcal)} over</span>
          ) : (
            <span style={{ color: ringColor }} className="font-semibold">{remaining} remaining</span>
          )}
          {" "}kcal
        </p>
      </div>
    </DashboardCard>
  );
}
