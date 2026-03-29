"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import type { BodyCompEntry } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";

/* ── Color constants ── */
const COLOR_BODY_FAT = "#f9c74f";
const COLOR_MUSCLE = "#4f9cf9";
const COLOR_GRID = "rgba(255,255,255,0.05)";
const COLOR_TICK = "rgba(255,255,255,0.3)";

/* ── Shared tooltip style ── */
const TT_STYLE: React.CSSProperties = {
  backgroundColor: "#1e1e22",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  color: "#e8e8e8",
  fontSize: 13,
  padding: "10px 14px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
};

interface Props {
  data: BodyCompEntry[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const day = new Date(label).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" });
  return (
    <div style={TT_STYLE}>
      <p style={{ fontWeight: 600, marginBottom: 4 }}>{day}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.dataKey === "body_fat_pct" ? "Body Fat" : "Muscle"}: {p.value}%
        </p>
      ))}
    </div>
  );
}

export function BodyCompCard({ data }: Props) {
  const hasFat = data.some((d) => d.body_fat_pct != null);
  const hasMuscle = data.some((d) => d.muscle_mass_pct != null);

  if (!hasFat && !hasMuscle) {
    return (
      <DashboardCard title="Body Composition" span="lg:col-span-1">
        <p className="text-sm text-muted-foreground">No body composition data yet</p>
      </DashboardCard>
    );
  }

  // Compute deltas for fat and muscle
  const fatPoints = data.filter((d) => d.body_fat_pct != null);
  const musclePoints = data.filter((d) => d.muscle_mass_pct != null);
  const latestFat = fatPoints.length > 0 ? fatPoints[fatPoints.length - 1].body_fat_pct : null;
  const firstFat = fatPoints.length > 1 ? fatPoints[0].body_fat_pct : null;
  const latestMuscle = musclePoints.length > 0 ? musclePoints[musclePoints.length - 1].muscle_mass_pct : null;
  const firstMuscle = musclePoints.length > 1 ? musclePoints[0].muscle_mass_pct : null;

  // Y-axis domain from all values
  const allVals: number[] = [];
  data.forEach((d) => {
    if (d.body_fat_pct != null) allVals.push(d.body_fat_pct);
    if (d.muscle_mass_pct != null) allVals.push(d.muscle_mass_pct);
  });
  const min = Math.floor(Math.min(...allVals) - 2);
  const max = Math.ceil(Math.max(...allVals) + 2);

  return (
    <DashboardCard title="Body Composition" span="lg:col-span-1">
      {/* Delta indicators */}
      <div className="flex items-center gap-4 -mt-1 mb-1">
        {latestFat != null && (
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold tabular-nums" style={{ color: COLOR_BODY_FAT }}>{latestFat}%</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">fat</span>
            {firstFat != null && (
              <span className={`text-xs font-semibold tabular-nums ${latestFat <= firstFat ? "text-primary" : "text-destructive"}`}>
                {latestFat <= firstFat ? "" : "+"}{(latestFat - firstFat).toFixed(1)}
              </span>
            )}
          </div>
        )}
        {latestMuscle != null && (
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold tabular-nums" style={{ color: COLOR_MUSCLE }}>{latestMuscle}%</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">muscle</span>
            {firstMuscle != null && (
              <span className={`text-xs font-semibold tabular-nums ${latestMuscle >= firstMuscle ? "text-primary" : "text-destructive"}`}>
                {latestMuscle >= firstMuscle ? "+" : ""}{(latestMuscle - firstMuscle).toFixed(1)}
              </span>
            )}
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLOR_GRID} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: COLOR_TICK, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => new Date(v).toLocaleDateString("en", { weekday: "short" })}
          />
          <YAxis
            domain={[min, max]}
            tick={{ fill: COLOR_TICK, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}
            formatter={(value: string) => (value === "body_fat_pct" ? "Body Fat" : "Muscle")}
          />
          {hasFat && (
            <Line
              type="monotone"
              dataKey="body_fat_pct"
              stroke={COLOR_BODY_FAT}
              strokeWidth={2}
              dot={{ fill: COLOR_BODY_FAT, r: 3, strokeWidth: 0 }}
              activeDot={{ fill: COLOR_BODY_FAT, r: 5, strokeWidth: 0 }}
              connectNulls
            />
          )}
          {hasMuscle && (
            <Line
              type="monotone"
              dataKey="muscle_mass_pct"
              stroke={COLOR_MUSCLE}
              strokeWidth={2}
              dot={{ fill: COLOR_MUSCLE, r: 3, strokeWidth: 0 }}
              activeDot={{ fill: COLOR_MUSCLE, r: 5, strokeWidth: 0 }}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </DashboardCard>
  );
}

// Keep legacy exports for backward compat (they just render the combined card)
export function BodyFatCard({ data }: Props) {
  return <BodyCompCard data={data} />;
}

export function MuscleCard(_props: Props) {
  // Now rendered inside BodyCompCard; this is a no-op to avoid breaking imports
  return null;
}
