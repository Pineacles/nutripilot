"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  Cell,
} from "recharts";
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
const COLOR_GRID = "rgba(255,255,255,0.05)";
const COLOR_TICK = "rgba(255,255,255,0.3)";
const COLOR_CURSOR = "rgba(255,255,255,0.03)";

interface Props {
  dailyAvgKcal: number;
  targetKcal: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TT_STYLE}>
      <p style={{ fontWeight: 600, marginBottom: 2 }}>{label}</p>
      <p style={{ color: COLOR_PRIMARY }}>{payload[0].value.toLocaleString()} kcal</p>
    </div>
  );
}

export function CalorieChartCard({ dailyAvgKcal, targetKcal }: Props) {
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const todayIdx = (new Date().getDay() + 6) % 7; // Mon=0

  const data = dayNames.map((day, i) => {
    const factor = i <= todayIdx ? 0.8 + Math.random() * 0.4 : 0;
    return {
      day,
      kcal: i <= todayIdx ? Math.round(dailyAvgKcal * factor) : 0,
      isToday: i === todayIdx,
    };
  });

  return (
    <DashboardCard title="7-Day Calories" span="lg:col-span-2">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barCategoryGap="20%">
          <defs>
            <linearGradient id="calBarGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4ade80" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0.6} />
            </linearGradient>
            <linearGradient id="calBarDim" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.18)" stopOpacity={1} />
              <stop offset="100%" stopColor="rgba(255,255,255,0.06)" stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={COLOR_GRID} vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: COLOR_TICK, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: COLOR_TICK, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={45}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: COLOR_CURSOR }}
          />
          <ReferenceLine
            y={targetKcal}
            stroke={COLOR_PRIMARY}
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{ value: `${targetKcal} kcal target`, fill: COLOR_PRIMARY, fontSize: 10, position: "insideTopRight" }}
          />
          <Bar dataKey="kcal" radius={[6, 6, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.isToday ? "url(#calBarGreen)" : "url(#calBarDim)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </DashboardCard>
  );
}
