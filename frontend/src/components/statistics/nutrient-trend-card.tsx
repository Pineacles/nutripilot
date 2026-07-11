import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine,
} from "recharts";
import { SectionCard } from "@/components/charts/section-card";
import { ChartTooltip } from "./chart-tooltip";
import { nthTickFormatter, type DailyNutritionLike } from "@/lib/chart-utils";
import { CHART_GRID_SUBTLE, CHART_GRID_DASH } from "@/lib/chart-theme";

interface Props {
  title: string;
  dataKey: "fiber" | "sugar" | "sodium" | "alcohol";
  unit: string;
  color: string;
  target: number;
  /** Fiber/sugar/sodium always render their reference line; alcohol only when a target is set. */
  showReferenceLine?: boolean;
  nutritionLength: number;
  rollingNutrition: (DailyNutritionLike & Record<string, number>)[];
}

/** Small single-metric 7-day-average trend chart — shared by Fiber/Sugar/Sodium/Alcohol. */
export function NutrientTrendCard({ title, dataKey, unit, color, target, showReferenceLine = true, nutritionLength, rollingNutrition }: Props) {
  return (
    <SectionCard title={`${title} Trend`}>
      {nutritionLength === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No data</p>
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <ComposedChart data={rollingNutrition} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id={`${dataKey}Grad`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray={CHART_GRID_DASH} stroke={CHART_GRID_SUBTLE} vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#888", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={nthTickFormatter(rollingNutrition, 4)}
            />
            <YAxis tick={{ fill: "#aaa", fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
            <Tooltip content={<ChartTooltip valueSuffix={` ${unit}`} />} />
            {showReferenceLine && (
              <ReferenceLine y={target} stroke={color} strokeDasharray="4 3" strokeWidth={1} strokeOpacity={0.6} />
            )}
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke="transparent"
              strokeWidth={0}
              dot={{ fill: color, r: 1.5, fillOpacity: 0.25, strokeWidth: 0 }}
              activeDot={false}
              animationDuration={600}
              legendType="none"
            />
            <Area
              type="monotone"
              dataKey={`avg_${dataKey}`}
              name={`${title} (7d avg)`}
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#${dataKey}Grad)`}
              dot={false}
              animationDuration={600}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </SectionCard>
  );
}
