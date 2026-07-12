"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { MacroTotals, MacroTargets, WaterTotals, CaffeineTotals } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";

/* ── Color constants (Recharts needs hex values) ── */
const COLOR_SUCCESS = "#4ade80";
const COLOR_WARNING = "#f9c74f";
const COLOR_DANGER  = "#f94f4f";
const COLOR_RING_BG = "#1f1f23";

interface Props {
  totals: MacroTotals;
  targets: MacroTargets;
  water?: WaterTotals | null;
  caffeine?: CaffeineTotals | null;
  span?: string;
}

function getRingColor(pct: number): string {
  if (pct > 1.0) return COLOR_DANGER;   // over target: red
  if (pct > 0.9) return COLOR_WARNING;  // 90-100%: amber
  return COLOR_SUCCESS;                // under 90%: green
}

function HydrationBar({ label, current, target, unit, gradient, budget }: {
  label: string; current: number; target: number; unit: string; gradient: string; budget?: boolean;
}) {
  const rawPct = target > 0 ? (current / target) * 100 : 0;
  const barPct = Math.min(rawPct, 100);
  const isOver = budget && rawPct > 100;
  let bg = gradient;
  if (budget && rawPct > 100) bg = "linear-gradient(90deg, #ef4444, #f87171)";
  else if (budget && rawPct > 80) bg = "linear-gradient(90deg, #f59e0b, #fbbf24)";

  return (
    <div className="group rounded-xl px-3 py-2 -mx-2 transition-all duration-200 hover:bg-muted/40 hover:translate-x-0.5">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors duration-150">{label}</span>
        <span className="text-sm tabular-nums text-foreground">
          <span className={`font-semibold ${isOver ? "text-destructive" : ""}`}>
            {Math.round(current)}{unit}
          </span>
          <span className="text-muted-foreground/50"> / {Math.round(target)}{unit}</span>
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-muted/60 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${barPct}%`, background: bg }}
        />
      </div>
    </div>
  );
}

export function CalorieRingCard({ totals, targets, water, caffeine, span }: Props) {
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
    <DashboardCard title="Calories & Hydration" span={span}>
      <div className="flex flex-col items-center justify-center">
        <div
          className="relative h-[150px] w-[150px]"
          style={{ filter: `drop-shadow(0 0 12px ${ringColor}33)` }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={68}
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
            <span className="text-[11px] text-muted-foreground">
              / {Math.round(targets.kcal)} kcal
            </span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1 tabular-nums">
          {rawPct > 1.0 ? (
            <span className="text-destructive font-semibold">{Math.round(totals.kcal - targets.kcal)} over</span>
          ) : (
            <span style={{ color: ringColor }} className="font-semibold">{remaining} remaining</span>
          )}
          {" "}kcal
        </p>
      </div>

      {/* Hydration & Alcohol bars: matches MacroBreakdown formatting */}
      <div className="mt-4 pt-3 border-t border-white/5 flex flex-col gap-1">
        {water && (
          <HydrationBar label="Water" current={water.total_ml} target={water.target_ml} unit=" ml"
            gradient="linear-gradient(90deg, #06b6d4, #22d3ee)" />
        )}
        {caffeine && (
          <HydrationBar label="Caffeine" current={caffeine.total_mg} target={caffeine.target_mg} unit=" mg"
            gradient="linear-gradient(90deg, #92400e, #b45309)" budget />
        )}
        {targets.alcohol > 0 && (
          <HydrationBar label="Alcohol" current={totals.alcohol} target={targets.alcohol} unit="g"
            gradient="linear-gradient(90deg, #f97316, #fb923c)" budget />
        )}
      </div>
    </DashboardCard>
  );
}
