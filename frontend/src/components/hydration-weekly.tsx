"use client";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip, CartesianGrid } from "recharts";
import type { DailyWater, DailyCaffeine } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";
import { fmt } from "@/lib/utils";

const TT_STYLE = {
  backgroundColor: "#1e1e22",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  color: "#e8e8e8",
  fontSize: 12,
  padding: "8px 12px",
} as const;

interface Props {
  dailyWater: DailyWater[];
  dailyCaffeine: DailyCaffeine[];
  targetWater: number;
  targetCaffeine: number;
}

export function HydrationWeeklyCard({ dailyWater, dailyCaffeine, targetWater, targetCaffeine }: Props) {
  const waterData = dailyWater.map(d => ({
    day: new Date(d.date + "T00:00:00").toLocaleDateString("en", { weekday: "short" }),
    ml: Math.round(d.total_ml),
  }));
  const caffData = dailyCaffeine.map(d => ({
    day: new Date(d.date + "T00:00:00").toLocaleDateString("en", { weekday: "short" }),
    mg: Math.round(d.total_mg),
  }));

  const hasWater = waterData.some(d => d.ml > 0);
  const hasCaff = caffData.some(d => d.mg > 0);

  if (!hasWater && !hasCaff) {
    return (
      <DashboardCard title="Hydration & Caffeine">
        <p className="text-sm text-muted-foreground py-4 text-center">No data this week</p>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title="Hydration & Caffeine">
      <div className="space-y-4">
        {hasWater && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Water (ml)</p>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={waterData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "#888", fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={TT_STYLE} formatter={(v) => [`${v} ml`, "Water"]} />
                <ReferenceLine y={targetWater} stroke="#06b6d4" strokeDasharray="4 3" strokeOpacity={0.5} />
                <Bar dataKey="ml" fill="#06b6d4" radius={[3, 3, 0, 0]} fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {hasCaff && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Caffeine (mg)</p>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={caffData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "#888", fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={TT_STYLE} formatter={(v) => [`${v} mg`, "Caffeine"]} />
                <ReferenceLine y={targetCaffeine} stroke="#b45309" strokeDasharray="4 3" strokeOpacity={0.5} />
                <Bar dataKey="mg" fill="#92400e" radius={[3, 3, 0, 0]} fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
