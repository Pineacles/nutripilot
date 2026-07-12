"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { BodyCompEntry } from "@/lib/types";
import { fmt } from "@/lib/utils";
import { DashboardCard } from "./dashboard-card";

/* ── Design tokens (consistent with calorie-chart / hydration-weekly) ── */
const COLOR_BODY_FAT = "#f9c74f";
const COLOR_MUSCLE = "#4f9cf9";
const COLOR_GRID = "rgba(255,255,255,0.06)";
const COLOR_TICK = { fill: "rgba(255,255,255,0.35)", fontSize: 10 };

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
          {p.dataKey === "body_fat_pct" ? "Body Fat" : "Muscle"}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value}%
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
      {/* Stats row: values + legend integrated */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-5">
          {latestFat != null && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR_BODY_FAT }} />
              <div>
                <span className="text-base font-bold tabular-nums" style={{ color: COLOR_BODY_FAT }}>{fmt(latestFat)}%</span>
                <span className="text-[10px] text-muted-foreground ml-1">fat</span>
              </div>
              {firstFat != null && (
                <span className={`text-[11px] font-semibold tabular-nums ${latestFat <= firstFat ? "text-primary" : "text-destructive"}`}>
                  {latestFat <= firstFat ? "" : "+"}{(latestFat - firstFat).toFixed(1)}
                </span>
              )}
            </div>
          )}
          {latestMuscle != null && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR_MUSCLE }} />
              <div>
                <span className="text-base font-bold tabular-nums" style={{ color: COLOR_MUSCLE }}>{fmt(latestMuscle)}%</span>
                <span className="text-[10px] text-muted-foreground ml-1">muscle</span>
              </div>
              {firstMuscle != null && (
                <span className={`text-[11px] font-semibold tabular-nums ${latestMuscle >= firstMuscle ? "text-primary" : "text-destructive"}`}>
                  {latestMuscle >= firstMuscle ? "+" : ""}{(latestMuscle - firstMuscle).toFixed(1)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 10, right: 8, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLOR_GRID} vertical={false} />
          <XAxis
            dataKey="date"
            tick={COLOR_TICK}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => new Date(v).toLocaleDateString("en", { weekday: "short" })}
          />
          <YAxis
            domain={[min, max]}
            tick={COLOR_TICK}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.1)" }} />
          {hasFat && (
            <Line
              type="monotone"
              dataKey="body_fat_pct"
              stroke={COLOR_BODY_FAT}
              strokeWidth={2.5}
              dot={{ fill: COLOR_BODY_FAT, r: 3, strokeWidth: 0 }}
              activeDot={{ fill: COLOR_BODY_FAT, r: 5, stroke: "#1e1e22", strokeWidth: 2 }}
              connectNulls
              animationDuration={800}
              animationEasing="ease-out"
            />
          )}
          {hasMuscle && (
            <Line
              type="monotone"
              dataKey="muscle_mass_pct"
              stroke={COLOR_MUSCLE}
              strokeWidth={2.5}
              dot={{ fill: COLOR_MUSCLE, r: 3, strokeWidth: 0 }}
              activeDot={{ fill: COLOR_MUSCLE, r: 5, stroke: "#1e1e22", strokeWidth: 2 }}
              connectNulls
              animationDuration={800}
              animationEasing="ease-out"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </DashboardCard>
  );
}
