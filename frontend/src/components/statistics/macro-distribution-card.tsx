"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { SectionCard } from "@/components/charts/section-card";
import { TT_STYLE } from "./chart-tooltip";
import { CHART_COLORS } from "@/lib/chart-theme";
import { fmt } from "@/lib/utils";
import type { MacroTotals } from "@/lib/types";

interface Props {
  macroAvg: MacroTotals | undefined;
}

export function MacroDistributionCard({ macroAvg }: Props) {
  const macroPie = useMemo(() => {
    if (!macroAvg) return [];
    const total = macroAvg.protein + macroAvg.carbs + macroAvg.fat;
    if (total === 0) return [];
    return [
      { name: "Protein", value: Math.round((macroAvg.protein / total) * 100), grams: Math.round(macroAvg.protein), fill: CHART_COLORS.blue },
      { name: "Carbs", value: Math.round((macroAvg.carbs / total) * 100), grams: Math.round(macroAvg.carbs), fill: CHART_COLORS.green },
      { name: "Fat", value: Math.round((macroAvg.fat / total) * 100), grams: Math.round(macroAvg.fat), fill: CHART_COLORS.amber },
    ];
  }, [macroAvg]);

  return (
    <SectionCard title="Macro Distribution">
      {macroPie.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No macro data</p>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="w-[180px] h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={macroPie}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  dataKey="value"
                  stroke="none"
                  animationDuration={800}
                >
                  {macroPie.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TT_STYLE}
                  formatter={(value: unknown, name: unknown) => [`${typeof value === "number" ? fmt(value) : value}%`, String(name)]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2.5 w-full">
            {macroPie.map(m => (
              <div key={m.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.fill }} />
                  <span className="text-sm text-muted-foreground">{m.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tabular-nums text-foreground">{m.value}%</span>
                  <span className="text-xs text-muted-foreground/60 tabular-nums">{m.grams}g</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
