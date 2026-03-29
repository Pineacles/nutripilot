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
import { DashboardCard } from "./dashboard-card";

/* ── Color constants (Recharts needs hex values) ── */
const COLOR_BODY_FAT  = "#f9c74f";
const COLOR_MUSCLE    = "#4f9cf9";
const COLOR_GRID      = "rgba(255,255,255,0.05)";
const COLOR_TICK      = "rgba(255,255,255,0.3)";

const TOOLTIP_STYLE = {
  backgroundColor: "#1a1a1a",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  color: "#e8e8e8",
  fontSize: 12,
  padding: "8px 12px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
} as const;

interface Props {
  data: BodyCompEntry[];
}

export function BodyFatCard({ data }: Props) {
  const points = data.filter((d) => d.body_fat_pct != null);

  if (points.length === 0) {
    return (
      <DashboardCard title="Body Fat %" className="col-span-1">
        <p className="text-sm text-muted-foreground">No body fat data yet</p>
      </DashboardCard>
    );
  }

  const latest = points[points.length - 1];
  const values = points.map((p) => p.body_fat_pct!);
  const min = Math.floor(Math.min(...values) - 2);
  const max = Math.ceil(Math.max(...values) + 2);

  return (
    <DashboardCard title="Body Fat %" className="col-span-1">
      <div className="flex items-baseline gap-2 -mt-1">
        <span className="text-2xl font-bold tabular-nums text-foreground">{latest.body_fat_pct}%</span>
        {points.length > 1 && (
          <span className={`text-sm font-semibold tabular-nums ${
            latest.body_fat_pct! <= points[0].body_fat_pct! ? "text-primary" : "text-destructive"
          }`}>
            {latest.body_fat_pct! <= points[0].body_fat_pct! ? "" : "+"}
            {(latest.body_fat_pct! - points[0].body_fat_pct!).toFixed(1)}%
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={points}>
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
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Line
            type="monotone"
            dataKey="body_fat_pct"
            stroke={COLOR_BODY_FAT}
            strokeWidth={2}
            dot={{ fill: COLOR_BODY_FAT, r: 3, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </DashboardCard>
  );
}

export function MuscleCard({ data }: Props) {
  const points = data.filter((d) => d.muscle_mass_pct != null);

  if (points.length === 0) {
    return (
      <DashboardCard title="Muscle Mass %" className="col-span-1">
        <p className="text-sm text-muted-foreground">No muscle data yet</p>
      </DashboardCard>
    );
  }

  const latest = points[points.length - 1];
  const values = points.map((p) => p.muscle_mass_pct!);
  const min = Math.floor(Math.min(...values) - 2);
  const max = Math.ceil(Math.max(...values) + 2);

  return (
    <DashboardCard title="Muscle Mass %" className="col-span-1">
      <div className="flex items-baseline gap-2 -mt-1">
        <span className="text-2xl font-bold tabular-nums text-foreground">{latest.muscle_mass_pct}%</span>
        {points.length > 1 && (
          <span className={`text-sm font-semibold tabular-nums ${
            latest.muscle_mass_pct! >= points[0].muscle_mass_pct! ? "text-primary" : "text-destructive"
          }`}>
            {latest.muscle_mass_pct! >= points[0].muscle_mass_pct! ? "+" : ""}
            {(latest.muscle_mass_pct! - points[0].muscle_mass_pct!).toFixed(1)}%
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={points}>
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
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Line
            type="monotone"
            dataKey="muscle_mass_pct"
            stroke={COLOR_MUSCLE}
            strokeWidth={2}
            dot={{ fill: COLOR_MUSCLE, r: 3, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </DashboardCard>
  );
}
