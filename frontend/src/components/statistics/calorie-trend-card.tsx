import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine,
} from "recharts";
import { SectionCard } from "@/components/charts/section-card";
import { ChartTooltip } from "./chart-tooltip";
import { fmtDateAxis, computeAxisInterval, type DailyNutritionLike } from "@/lib/chart-utils";
import { CHART_COLORS, CHART_GRID_SUBTLE, CHART_GRID_DASH, CHART_TICK_X, CHART_TICK_Y } from "@/lib/chart-theme";

interface Props {
  nutritionLength: number;
  rollingNutrition: (DailyNutritionLike & Record<string, number>)[];
  targetKcal: number;
}

export function CalorieTrendCard({ nutritionLength, rollingNutrition, targetKcal }: Props) {
  return (
    <SectionCard title="Calorie Trend" span="lg:col-span-2">
      {nutritionLength === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No calorie data</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={rollingNutrition} margin={{ top: 5, right: 10, bottom: 30, left: 0 }}>
            <defs>
              <linearGradient id="calAvgGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.green} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS.green} stopOpacity={0.02} />
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
            <YAxis tick={CHART_TICK_Y} axisLine={false} tickLine={false} width={45} />
            <Tooltip content={<ChartTooltip valueSuffix=" kcal" />} />
            <ReferenceLine
              y={targetKcal}
              stroke={CHART_COLORS.amber}
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{ value: `Target ${targetKcal}`, fill: "#888", fontSize: 10, position: "right" }}
            />
            <Area
              type="monotone"
              dataKey="avg_kcal"
              name="7-day avg"
              stroke={CHART_COLORS.green}
              strokeWidth={2.5}
              fill="url(#calAvgGrad)"
              dot={false}
              activeDot={{ r: 5, stroke: CHART_COLORS.green, strokeWidth: 2, fill: "#1e1e22" }}
              animationDuration={800}
            />
            <Line
              type="monotone"
              dataKey="kcal"
              name="Daily kcal"
              stroke="transparent"
              strokeWidth={0}
              dot={{ fill: CHART_COLORS.green, r: 2, fillOpacity: 0.3, strokeWidth: 0 }}
              activeDot={{ r: 4, stroke: CHART_COLORS.green, strokeWidth: 1, fill: "#1e1e22" }}
              animationDuration={600}
              legendType="none"
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </SectionCard>
  );
}
