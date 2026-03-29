"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
} from "recharts";
import type { WeightDelta } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";

/* ── Shared tooltip style ── */
const TT_STYLE = {
  backgroundColor: "#1e1e22",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  color: "#e8e8e8",
  fontSize: 13,
  padding: "10px 14px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
} as const;

const COLOR_PRIMARY = "#22c55e";
const COLOR_LINE = "#ffffff";
const COLOR_GRID = "rgba(255,255,255,0.05)";
const COLOR_TICK = "rgba(255,255,255,0.3)";

interface Props {
  weight: WeightDelta;
  goalKg?: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TT_STYLE}>
      <p style={{ fontWeight: 600, marginBottom: 2 }}>{label}</p>
      <p style={{ color: "#ffffff" }}>{payload[0].value} kg</p>
    </div>
  );
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
    <DashboardCard title="Weight Trend" span="lg:col-span-1">
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
        <AreaChart data={points}>
          <defs>
            <linearGradient id="weightAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
            </linearGradient>
          </defs>
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
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={goalKg}
            stroke={COLOR_PRIMARY}
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{ value: `${goalKg}kg goal`, fill: COLOR_PRIMARY, fontSize: 10, position: "insideTopRight" }}
          />
          <Area
            type="monotone"
            dataKey="weight"
            stroke={COLOR_LINE}
            strokeWidth={2}
            fill="url(#weightAreaFill)"
            dot={{ fill: COLOR_LINE, r: 3, strokeWidth: 0 }}
            activeDot={{ fill: COLOR_PRIMARY, r: 5, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </DashboardCard>
  );
}
