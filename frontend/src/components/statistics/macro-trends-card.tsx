"use client";

import { useState } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine,
} from "recharts";
import { SectionCard } from "@/components/charts/section-card";
import { MultiLineTooltip } from "./chart-tooltip";
import { fmtDateAxis, computeAxisInterval, type DailyNutritionLike } from "@/lib/chart-utils";
import { CHART_COLORS, CHART_GRID_SUBTLE, CHART_GRID_DASH, CHART_TICK_X, CHART_TICK_Y } from "@/lib/chart-theme";

interface Props {
  nutritionLength: number;
  rollingNutrition: (DailyNutritionLike & Record<string, number>)[];
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
}

export function MacroTrendsCard({ nutritionLength, rollingNutrition, targetProtein, targetCarbs, targetFat }: Props) {
  const [macroTab, setMacroTab] = useState<"protein" | "carbs" | "fat" | "all">("all");

  return (
    <SectionCard title="Macro Trends" span="lg:col-span-3">
      {nutritionLength === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No macro data</p>
      ) : (
        <>
          <div className="flex gap-1.5 mb-4">
            {(["all", "protein", "carbs", "fat"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setMacroTab(tab)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                  macroTab === tab
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={rollingNutrition} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="proteinGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="carbsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.green} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={CHART_COLORS.green} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fatGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.amber} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={CHART_COLORS.amber} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray={CHART_GRID_DASH} stroke={CHART_GRID_SUBTLE} vertical={false} />
              <XAxis
                dataKey="date"
                tick={CHART_TICK_X}
                axisLine={false}
                tickLine={false}
                interval={computeAxisInterval(rollingNutrition.length)}
                tickFormatter={(v: string) => fmtDateAxis(v, rollingNutrition.length)}
              />
              <YAxis tick={CHART_TICK_Y} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<MultiLineTooltip />} />
              {(macroTab === "all" || macroTab === "protein") && (
                <>
                  <Line type="monotone" dataKey="protein" name="Protein (raw)" stroke="transparent" strokeWidth={0} dot={{ fill: CHART_COLORS.blue, r: 1.5, fillOpacity: 0.25, strokeWidth: 0 }} activeDot={false} animationDuration={600} legendType="none" />
                  <Area type="monotone" dataKey="avg_protein" name="Protein (g)" stroke={CHART_COLORS.blue} strokeWidth={2} fill="url(#proteinGrad)" dot={false} animationDuration={600} />
                  {macroTab === "protein" && (
                    <ReferenceLine y={targetProtein} stroke={CHART_COLORS.blue} strokeDasharray="6 3" strokeWidth={1} />
                  )}
                </>
              )}
              {(macroTab === "all" || macroTab === "carbs") && (
                <>
                  <Line type="monotone" dataKey="carbs" name="Carbs (raw)" stroke="transparent" strokeWidth={0} dot={{ fill: CHART_COLORS.green, r: 1.5, fillOpacity: 0.25, strokeWidth: 0 }} activeDot={false} animationDuration={600} legendType="none" />
                  <Area type="monotone" dataKey="avg_carbs" name="Carbs (g)" stroke={CHART_COLORS.green} strokeWidth={2} fill="url(#carbsGrad)" dot={false} animationDuration={600} />
                  {macroTab === "carbs" && (
                    <ReferenceLine y={targetCarbs} stroke={CHART_COLORS.green} strokeDasharray="6 3" strokeWidth={1} />
                  )}
                </>
              )}
              {(macroTab === "all" || macroTab === "fat") && (
                <>
                  <Line type="monotone" dataKey="fat" name="Fat (raw)" stroke="transparent" strokeWidth={0} dot={{ fill: CHART_COLORS.amber, r: 1.5, fillOpacity: 0.25, strokeWidth: 0 }} activeDot={false} animationDuration={600} legendType="none" />
                  <Area type="monotone" dataKey="avg_fat" name="Fat (g)" stroke={CHART_COLORS.amber} strokeWidth={2} fill="url(#fatGrad)" dot={false} animationDuration={600} />
                  {macroTab === "fat" && (
                    <ReferenceLine y={targetFat} stroke={CHART_COLORS.amber} strokeDasharray="6 3" strokeWidth={1} />
                  )}
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}
    </SectionCard>
  );
}
