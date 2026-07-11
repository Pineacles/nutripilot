import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine,
} from "recharts";
import { SectionCard } from "@/components/charts/section-card";
import { ChartTooltip } from "./chart-tooltip";
import { nthTickFormatter } from "@/lib/chart-utils";
import { CHART_COLORS, CHART_GRID_SUBTLE, CHART_GRID_DASH } from "@/lib/chart-theme";
import type { DailyCaffeine } from "@/lib/types";

interface Props {
  dailyCaffeine: DailyCaffeine[] | undefined;
  targetCaffeineMg: number;
}

export function CaffeineTrendCard({ dailyCaffeine, targetCaffeineMg }: Props) {
  return (
    <SectionCard title="Caffeine Trend">
      {(!dailyCaffeine || dailyCaffeine.length === 0) ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No caffeine data</p>
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={dailyCaffeine} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id="caffGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.caffeine} stopOpacity={0.25} />
                <stop offset="95%" stopColor={CHART_COLORS.caffeine} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray={CHART_GRID_DASH} stroke={CHART_GRID_SUBTLE} vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#888", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={nthTickFormatter(dailyCaffeine, 4)}
            />
            <YAxis tick={{ fill: "#aaa", fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
            <Tooltip content={<ChartTooltip valueSuffix=" mg" />} />
            <ReferenceLine y={targetCaffeineMg} stroke={CHART_COLORS.caffeineDark} strokeDasharray="4 3" strokeWidth={1} strokeOpacity={0.6} />
            <Area
              type="monotone"
              dataKey="total_mg"
              name="Caffeine (mg)"
              stroke={CHART_COLORS.caffeine}
              strokeWidth={2}
              fill="url(#caffGrad)"
              dot={{ fill: CHART_COLORS.caffeine, r: 2, strokeWidth: 0 }}
              activeDot={{ r: 4, stroke: CHART_COLORS.caffeine, strokeWidth: 2, fill: "#1e1e22" }}
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </SectionCard>
  );
}
