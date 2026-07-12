import {
  AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine,
} from "recharts";
import { SectionCard } from "@/components/charts/section-card";
import { ChartTooltip } from "./chart-tooltip";
import { nthTickFormatter } from "@/lib/chart-utils";
import { CHART_GRID_SOLID, CHART_GRID_DASH, CHART_TICK_X, CHART_TICK_Y } from "@/lib/chart-theme";

type DataRow = Record<string, unknown>;

interface Props {
  title: string;
  span?: string;
  data: DataRow[];
  hasData: boolean;
  emptyMessage: string;
  gradientId: string;
  dataKey: string;
  avgKey: string;
  color: string;
  height: number;
  tickMaxLabels?: number;
  valueSuffix: string;
  /** Only the Weight Trend card renders a goal reference line. */
  referenceValue?: number | null;
}

/**
 * One shape, five charts: Weight/Body Fat %/Muscle %/Fat kg/Muscle kg trends on
 * the body-composition page all render the same area+scatter+rolling-avg-line
 * combination, parameterized here instead of five near-identical blocks.
 */
export function MetricTrendCard({
  title, span, data, hasData, emptyMessage, gradientId, dataKey, avgKey, color, height,
  tickMaxLabels = 8, valueSuffix, referenceValue,
}: Props) {
  return (
    <SectionCard title={title} span={span}>
      {hasData ? (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART_GRID_SOLID} strokeDasharray={CHART_GRID_DASH} />
            <XAxis dataKey="date" tickFormatter={nthTickFormatter(data as { date: string }[], tickMaxLabels)} tick={CHART_TICK_X} axisLine={false} tickLine={false} />
            <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={CHART_TICK_Y} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip valueSuffix={valueSuffix} valueKey={avgKey} />} />
            {referenceValue != null && (
              <ReferenceLine y={referenceValue} stroke={color} strokeDasharray="6 4" strokeOpacity={0.5} />
            )}
            <Area type="monotone" dataKey={dataKey} stroke="none" fill={`url(#${gradientId})`} fillOpacity={1} />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={0} dot={{ r: 2, fill: color, fillOpacity: 0.3, strokeWidth: 0 }} activeDot={false} connectNulls />
            <Line type="monotone" dataKey={avgKey} stroke={color} strokeWidth={2.5} dot={false} connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-muted-foreground py-12 text-center">{emptyMessage}</p>
      )}
    </SectionCard>
  );
}
