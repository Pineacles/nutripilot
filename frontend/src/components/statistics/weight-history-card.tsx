import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine,
} from "recharts";
import { SectionCard } from "@/components/charts/section-card";
import { ChartTooltip } from "./chart-tooltip";
import { fmtDateAxis, computeAxisInterval } from "@/lib/chart-utils";
import { CHART_COLORS, CHART_GRID_SUBTLE, CHART_GRID_DASH, CHART_TICK_X, CHART_TICK_Y } from "@/lib/chart-theme";
import type { BodyCompEntry } from "@/lib/types";

interface Props {
  weightData: BodyCompEntry[];
  targetWeight: number | null;
}

export function WeightHistoryCard({ weightData, targetWeight }: Props) {
  return (
    <SectionCard title="Weight History" span="lg:col-span-2">
      {weightData.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No weight data recorded yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={weightData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.green} stopOpacity={0.25} />
                <stop offset="95%" stopColor={CHART_COLORS.green} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray={CHART_GRID_DASH} stroke={CHART_GRID_SUBTLE} vertical={false} />
            <XAxis
              dataKey="date"
              tick={CHART_TICK_X}
              axisLine={false}
              tickLine={false}
              interval={computeAxisInterval(weightData.length)}
              tickFormatter={(v: string) => fmtDateAxis(v, weightData.length)}
            />
            <YAxis tick={CHART_TICK_Y} axisLine={false} tickLine={false} width={40} domain={["auto", "auto"]} />
            <Tooltip content={<ChartTooltip valueSuffix=" kg" />} />
            {targetWeight != null && (
              <ReferenceLine y={targetWeight} stroke={CHART_COLORS.blue} strokeDasharray="6 3" strokeWidth={1.5} label={{ value: `Target ${targetWeight} kg`, fill: "#666", fontSize: 10, position: "right" }} />
            )}
            <Area
              type="monotone"
              dataKey="weight_kg"
              stroke={CHART_COLORS.green}
              strokeWidth={2.5}
              fill="url(#weightGrad)"
              dot={{ fill: CHART_COLORS.green, r: 2, strokeWidth: 0 }}
              activeDot={{ r: 5, stroke: CHART_COLORS.green, strokeWidth: 2, fill: "#1e1e22" }}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </SectionCard>
  );
}
