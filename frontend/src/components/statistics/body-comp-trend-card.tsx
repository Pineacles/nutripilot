import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend,
} from "recharts";
import { SectionCard } from "@/components/charts/section-card";
import { MultiLineTooltip } from "./chart-tooltip";
import { nthTickFormatter } from "@/lib/chart-utils";
import { CHART_COLORS, CHART_GRID_SUBTLE, CHART_GRID_DASH, CHART_TICK_X, CHART_TICK_Y } from "@/lib/chart-theme";
import type { BodyCompEntry } from "@/lib/types";

interface Props {
  bodyCompData: BodyCompEntry[];
}

/** Body-fat/muscle % lines on the statistics page (distinct from the body page's own charts). */
export function BodyCompTrendCard({ bodyCompData }: Props) {
  return (
    <SectionCard title="Body Composition">
      {bodyCompData.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No body composition data</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={bodyCompData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray={CHART_GRID_DASH} stroke={CHART_GRID_SUBTLE} vertical={false} />
            <XAxis
              dataKey="date"
              tick={CHART_TICK_X}
              axisLine={false}
              tickLine={false}
              tickFormatter={nthTickFormatter(bodyCompData, 6)}
            />
            <YAxis tick={CHART_TICK_Y} axisLine={false} tickLine={false} width={35} domain={["auto", "auto"]} />
            <Tooltip content={<MultiLineTooltip />} />
            <Legend
              verticalAlign="top"
              height={28}
              iconType="circle"
              iconSize={8}
              formatter={(value: string) => <span style={{ color: "#aaa", fontSize: 11 }}>{value}</span>}
            />
            <Line
              type="monotone"
              dataKey="body_fat_pct"
              name="Body Fat %"
              stroke={CHART_COLORS.amber}
              strokeWidth={2}
              dot={{ fill: CHART_COLORS.amber, r: 2, strokeWidth: 0 }}
              activeDot={{ r: 4, stroke: CHART_COLORS.amber, strokeWidth: 2, fill: "#1e1e22" }}
              connectNulls
              animationDuration={800}
            />
            <Line
              type="monotone"
              dataKey="muscle_mass_pct"
              name="Muscle %"
              stroke={CHART_COLORS.blue}
              strokeWidth={2}
              dot={{ fill: CHART_COLORS.blue, r: 2, strokeWidth: 0 }}
              activeDot={{ r: 4, stroke: CHART_COLORS.blue, strokeWidth: 2, fill: "#1e1e22" }}
              connectNulls
              animationDuration={800}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </SectionCard>
  );
}
