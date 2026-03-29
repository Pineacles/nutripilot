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

/* ── Color constants (Recharts needs hex values) ── */
const COLOR_PRIMARY   = "#22c55e";
const COLOR_BAR_REST  = "rgba(255,255,255,0.15)";
const COLOR_GRID      = "rgba(255,255,255,0.05)";
const COLOR_TICK      = "rgba(255,255,255,0.3)";
const COLOR_TOOLTIP_BG = "#1a1a1a";
const COLOR_TOOLTIP_FG = "#e8e8e8";
const COLOR_CURSOR     = "rgba(255,255,255,0.03)";

const TOOLTIP_STYLE = {
  backgroundColor: COLOR_TOOLTIP_BG,
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  color: COLOR_TOOLTIP_FG,
  fontSize: 13,
  padding: "8px 12px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
} as const;

interface Props {
  dailyAvgKcal: number;
  targetKcal: number;
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
    <DashboardCard title="7-Day Calories" className="col-span-2">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barCategoryGap="20%">
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
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: COLOR_CURSOR }}
          />
          <ReferenceLine
            y={targetKcal}
            stroke={COLOR_PRIMARY}
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{ value: "Target", fill: COLOR_PRIMARY, fontSize: 10, position: "insideTopRight" }}
          />
          <Bar dataKey="kcal" radius={[6, 6, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.isToday ? COLOR_PRIMARY : COLOR_BAR_REST}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </DashboardCard>
  );
}
