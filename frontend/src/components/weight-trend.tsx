"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
} from "recharts";
import type { WeightDelta } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";

/* ── Color constants (Recharts needs hex values) ── */
const COLOR_PRIMARY    = "#22c55e";
const COLOR_DANGER     = "#f94f4f";
const COLOR_LINE       = "#ffffff";
const COLOR_GRID       = "rgba(255,255,255,0.05)";
const COLOR_TICK       = "rgba(255,255,255,0.3)";

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
  weight: WeightDelta;
  goalKg?: number;
}

export function WeightTrendCard({ weight, goalKg = 78 }: Props) {
  const startKg = weight.start_kg || goalKg;
  const endKg = weight.end_kg || goalKg;
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const points = dayNames.map((day, i) => {
    const progress = i / 6;
    const baseWeight = startKg + (endKg - startKg) * progress;
    const jitter = (Math.random() - 0.5) * 0.3;
    return {
      day,
      weight: Math.round((baseWeight + jitter) * 10) / 10,
    };
  });

  const allW = points.map((p) => p.weight);
  const minW = Math.floor(Math.min(...allW, goalKg) - 1);
  const maxW = Math.ceil(Math.max(...allW, goalKg) + 1);

  return (
    <DashboardCard title="Weight Trend" className="col-span-1">
      <div className="flex items-baseline gap-2 -mt-1">
        {weight.end_kg && (
          <span className="text-2xl font-bold tabular-nums text-foreground">{weight.end_kg} kg</span>
        )}
        {weight.delta != null && (
          <span
            className={`text-sm font-semibold tabular-nums ${
              weight.delta <= 0 ? "text-primary" : "text-destructive"
            }`}
          >
            {weight.delta > 0 ? "+" : ""}{weight.delta} kg
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={points}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLOR_GRID} vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: COLOR_TICK, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[minW, maxW]}
            tick={{ fill: COLOR_TICK, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={35}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <ReferenceLine
            y={goalKg}
            stroke={COLOR_PRIMARY}
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{ value: `${goalKg}kg`, fill: COLOR_PRIMARY, fontSize: 10, position: "insideTopRight" }}
          />
          <Line
            type="monotone"
            dataKey="weight"
            stroke={COLOR_LINE}
            strokeWidth={2}
            dot={{ fill: COLOR_LINE, r: 3, strokeWidth: 0 }}
            activeDot={{ fill: COLOR_PRIMARY, r: 5, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </DashboardCard>
  );
}
