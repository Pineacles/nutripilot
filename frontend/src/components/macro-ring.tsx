"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { MacroTotals, MacroTargets, WaterTotals, CaffeineTotals } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";
import { useTracked } from "@/hooks/use-tracked";

/* ── Color constants (Recharts needs hex values) ── */
const COLOR_RING = "var(--ink)";
const COLOR_RING_BG = "var(--g2)";

interface Props {
  totals: MacroTotals;
  targets: MacroTargets;
  water?: WaterTotals | null;
  caffeine?: CaffeineTotals | null;
  span?: string;
}

function HydrationBar({ label, current, target, unit, gradient, budget }: {
  label: string; current: number; target: number; unit: string; gradient: string; budget?: boolean;
}) {
  const rawPct = target > 0 ? (current / target) * 100 : 0;
  const barPct = Math.min(rawPct, 100);
  const isOver = budget && rawPct > 100;
  const bg = isOver ? "var(--ink)" : gradient;

  return (
    <div className="group rounded-xl px-3 py-2 -mx-2 transition-all duration-200 hover:bg-muted/40 hover:translate-x-0.5">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors duration-150">{label}</span>
        <span className="text-sm tabular-nums text-foreground">
          <span className={`text-ink ${isOver ? "font-semibold" : ""}`}>
            {isOver && <span className="mr-1.5 text-[12px]">over</span>}{Math.round(current)}{unit}
          </span>
          <span className="text-muted-foreground/50"> / {Math.round(target)}{unit}</span>
        </span>
      </div>
      <div className="h-[3px] w-full bg-g2 overflow-hidden">
        <div
          className="animate-bar h-full"
          style={{ width: `${barPct}%`, background: bg }}
        />
      </div>
    </div>
  );
}

export function CalorieRingCard({ totals, targets, water, caffeine, span }: Props) {
  const { shows } = useTracked();
  const showWater = !!water && shows("water");
  const showCaffeine = !!caffeine && shows("caffeine");
  const showAlcohol = targets.alcohol > 0 && shows("alcohol");
  const eaten = Math.round(totals.kcal);
  const remaining = Math.max(0, Math.round(targets.kcal - totals.kcal));
  const rawPct = targets.kcal > 0 ? totals.kcal / targets.kcal : 0;
  const pct = Math.min(rawPct, 1);
  const ringColor = COLOR_RING;

  const data = [
    { value: pct * 100, fill: ringColor },
    { value: (1 - pct) * 100, fill: COLOR_RING_BG },
  ];

  return (
    <DashboardCard title={showWater || showCaffeine || showAlcohol ? "Calories & Hydration" : "Calories"} span={span}>
      <div className="flex flex-col items-center justify-center">
        <div className="relative h-[150px] w-[150px]">
          <ResponsiveContainer minWidth={0} width="100%" height="100%">
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
            <span className="font-semibold text-ink">+{Math.round(totals.kcal - targets.kcal)} over</span>
          ) : (
            <span className="font-semibold text-ink">{remaining} remaining</span>
          )}
          {" "}kcal
        </p>
      </div>

      {/* Hydration & Alcohol bars: matches MacroBreakdown formatting */}
      {(showWater || showCaffeine || showAlcohol) && (
      <div className="mt-4 pt-3 border-t border-g2 flex flex-col gap-1">
        {water && showWater && (
          <HydrationBar label="Water" current={water.total_ml} target={water.target_ml} unit=" ml"
            gradient="var(--ink)" />
        )}
        {caffeine && showCaffeine && (
          <HydrationBar label="Caffeine" current={caffeine.total_mg} target={caffeine.target_mg} unit=" mg"
            gradient="var(--g5)" budget />
        )}
        {showAlcohol && (
          <HydrationBar label="Alcohol" current={totals.alcohol} target={targets.alcohol} unit="g"
            gradient="var(--g5)" budget />
        )}
      </div>
      )}
    </DashboardCard>
  );
}
