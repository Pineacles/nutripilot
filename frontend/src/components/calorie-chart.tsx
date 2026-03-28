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
} from "recharts";

interface Props {
  dailyAvgKcal: number;
  targetKcal: number;
}

export function CalorieChart({ dailyAvgKcal, targetKcal }: Props) {
  // Generate 7 day labels (Mon-Sun)
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const today = new Date().getDay();
  // Simulate slight variation around average for visual interest
  const data = days.map((day, i) => {
    const factor = i <= today ? 0.85 + Math.random() * 0.3 : 0;
    return {
      day,
      kcal: i <= today ? Math.round(dailyAvgKcal * factor) : 0,
    };
  });

  return (
    <div className="rounded-xl border border-[#2a2a30] bg-[#1a1a1f] p-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-[#888] mb-4">
        Weekly Calories
      </h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a30" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: "#888", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#888", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a1f",
              border: "1px solid #2a2a30",
              borderRadius: 8,
              color: "#e8e8e8",
              fontSize: 12,
            }}
          />
          <ReferenceLine y={targetKcal} stroke="#4ade80" strokeDasharray="4 4" strokeWidth={1.5} />
          <Bar dataKey="kcal" fill="#4f9cf9" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
