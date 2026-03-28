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

interface Props {
  weight: WeightDelta;
  goalKg?: number;
}

export function WeightTrend({ weight, goalKg = 78 }: Props) {
  // Generate mock trend from start to end for visual
  const points = [];
  const startKg = weight.start_kg || goalKg;
  const endKg = weight.end_kg || goalKg;
  for (let i = 0; i < 7; i++) {
    const progress = i / 6;
    const baseWeight = startKg + (endKg - startKg) * progress;
    const jitter = (Math.random() - 0.5) * 0.4;
    points.push({
      day: `Day ${i + 1}`,
      weight: Math.round((baseWeight + jitter) * 10) / 10,
    });
  }

  const allWeights = points.map((p) => p.weight);
  const minW = Math.min(...allWeights, goalKg) - 1;
  const maxW = Math.max(...allWeights, goalKg) + 1;

  return (
    <div className="rounded-xl border border-[#2a2a30] bg-[#1a1a1f] p-4">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-xs font-medium uppercase tracking-wider text-[#888]">
          Weight Trend
        </h3>
        {weight.delta != null && (
          <span
            className={`text-sm font-semibold tabular-nums ${
              weight.delta <= 0 ? "text-[#4ade80]" : "text-[#f94f4f]"
            }`}
          >
            {weight.delta > 0 ? "+" : ""}
            {weight.delta} kg
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={points}>
          <defs>
            <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#e8e8e8" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#e8e8e8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a30" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: "#888", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis domain={[minW, maxW]} tick={{ fill: "#888", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a1f",
              border: "1px solid #2a2a30",
              borderRadius: 8,
              color: "#e8e8e8",
              fontSize: 12,
            }}
          />
          <ReferenceLine y={goalKg} stroke="#4ade80" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: `Goal ${goalKg}kg`, fill: "#4ade80", fontSize: 10, position: "insideTopRight" }} />
          <Area type="monotone" dataKey="weight" stroke="#e8e8e8" strokeWidth={2} fill="url(#weightGrad)" dot={{ fill: "#e8e8e8", r: 3 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
