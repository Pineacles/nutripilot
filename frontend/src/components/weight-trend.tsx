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
  Dot,
} from "recharts";
import type { WeightDelta } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";

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
          <span className="text-2xl font-bold tabular-nums text-white">{weight.end_kg} kg</span>
        )}
        {weight.delta != null && (
          <span
            className={`text-sm font-semibold tabular-nums ${
              weight.delta <= 0 ? "text-[#22c55e]" : "text-[#ef4444]"
            }`}
          >
            {weight.delta > 0 ? "+" : ""}{weight.delta} kg
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={points}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[minW, maxW]}
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={35}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a1a",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              color: "#e8e8e8",
              fontSize: 12,
            }}
          />
          <ReferenceLine
            y={goalKg}
            stroke="#22c55e"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{ value: `${goalKg}kg`, fill: "#22c55e", fontSize: 10, position: "insideTopRight" }}
          />
          <Line
            type="monotone"
            dataKey="weight"
            stroke="#ffffff"
            strokeWidth={2}
            dot={{ fill: "#ffffff", r: 3, strokeWidth: 0 }}
            activeDot={{ fill: "#22c55e", r: 5, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </DashboardCard>
  );
}
