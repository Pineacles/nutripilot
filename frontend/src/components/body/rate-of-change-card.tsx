import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";
import { SectionCard } from "@/components/charts/section-card";
import { ChartTooltip } from "./chart-tooltip";
import { nthTickFormatter } from "@/lib/chart-utils";
import { CHART_COLORS, CHART_GRID_SOLID, CHART_GRID_DASH, CHART_TICK_X, CHART_TICK_Y } from "@/lib/chart-theme";
import { fmt } from "@/lib/utils";

interface Props {
  weeklyRateData: { date: string; rate: number }[];
  weeklyAvgChange: number | null;
}

export function RateOfChangeCard({ weeklyRateData, weeklyAvgChange }: Props) {
  return (
    <SectionCard title="Rate of Change">
      {weeklyRateData.length > 0 ? (
        <div className="space-y-3">
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={weeklyRateData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <CartesianGrid stroke={CHART_GRID_SOLID} strokeDasharray={CHART_GRID_DASH} />
              <XAxis dataKey="date" tickFormatter={nthTickFormatter(weeklyRateData, 4)} tick={CHART_TICK_X} axisLine={false} tickLine={false} />
              <YAxis tick={CHART_TICK_Y} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip valueSuffix=" kg/w" valueKey="rate" />} />
              <ReferenceLine y={0} stroke="#555" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="rate" stroke={CHART_COLORS.purple} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="pill flex items-center justify-between px-3 py-2">
            <span className="text-xs text-muted-foreground">Avg weekly rate</span>
            <span className={`text-xs font-semibold ${weeklyAvgChange != null && weeklyAvgChange < 0 ? "text-green-400" : "text-amber-400"}`}>
              {weeklyAvgChange != null ? `${weeklyAvgChange > 0 ? "+" : ""}${fmt(weeklyAvgChange, 2)} kg/w` : "--"}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-12 text-center">Need 8+ data points</p>
      )}
    </SectionCard>
  );
}
