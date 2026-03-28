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
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={45}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a1a",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              color: "#e8e8e8",
              fontSize: 12,
            }}
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
          />
          <ReferenceLine
            y={targetKcal}
            stroke="#22c55e"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{ value: "Target", fill: "#22c55e", fontSize: 10, position: "insideTopRight" }}
          />
          <Bar dataKey="kcal" radius={[6, 6, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.isToday ? "#22c55e" : "rgba(255,255,255,0.15)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </DashboardCard>
  );
}
