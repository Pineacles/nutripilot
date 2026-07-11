import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend,
} from "recharts";
import { SectionCard } from "@/components/charts/section-card";
import { MultiLineTooltip } from "./chart-tooltip";
import { nthTickFormatter } from "@/lib/chart-utils";
import { CHART_COLORS, CHART_GRID_SOLID, CHART_GRID_DASH, CHART_TICK_X, CHART_TICK_Y } from "@/lib/chart-theme";

type DataRow = Record<string, unknown>;

interface Props {
  enrichedData: DataRow[];
}

export function ProgressOverviewCard({ enrichedData }: Props) {
  return (
    <SectionCard title="Progress Overview" span="lg:col-span-3">
      {enrichedData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={enrichedData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid stroke={CHART_GRID_SOLID} strokeDasharray={CHART_GRID_DASH} />
            <XAxis dataKey="date" tickFormatter={nthTickFormatter(enrichedData as { date: string }[])} tick={CHART_TICK_X} axisLine={false} tickLine={false} />
            <YAxis yAxisId="weight" orientation="left" domain={["dataMin - 2", "dataMax + 2"]} tick={CHART_TICK_Y} axisLine={false} tickLine={false} label={{ value: "kg", position: "insideTopLeft", fill: "#666", fontSize: 10 }} />
            <YAxis yAxisId="pct" orientation="right" domain={["dataMin - 2", "dataMax + 2"]} tick={CHART_TICK_Y} axisLine={false} tickLine={false} label={{ value: "%", position: "insideTopRight", fill: "#666", fontSize: 10 }} />
            <Tooltip content={<MultiLineTooltip />} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, color: "#aaa" }}
            />
            <Line yAxisId="weight" type="monotone" dataKey="weight_kg_avg" name="Weight (kg)" stroke={CHART_COLORS.green} strokeWidth={2} dot={false} connectNulls />
            <Line yAxisId="pct" type="monotone" dataKey="body_fat_pct_avg" name="Body Fat (%)" stroke={CHART_COLORS.amber} strokeWidth={2} dot={false} connectNulls />
            <Line yAxisId="pct" type="monotone" dataKey="muscle_mass_pct_avg" name="Muscle (%)" stroke={CHART_COLORS.blue} strokeWidth={2} dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-muted-foreground py-12 text-center">No data for this period</p>
      )}
    </SectionCard>
  );
}
