"use client";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip, CartesianGrid, Cell } from "recharts";
import type { DailyWater, DailyCaffeine } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";

/* ── Design tokens (consistent with calorie-chart) ── */
const GRID_STROKE = "rgba(255,255,255,0.06)";
const TICK = { fill: "rgba(255,255,255,0.35)", fontSize: 10 };
const CURSOR_FILL = "rgba(255,255,255,0.03)";
const TT_STYLE: React.CSSProperties = {
  backgroundColor: "#1e1e22",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  color: "#e8e8e8",
  fontSize: 13,
  padding: "10px 14px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function WaterTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TT_STYLE}>
      <p style={{ fontWeight: 600, marginBottom: 2 }}>{label}</p>
      <p style={{ color: "#22d3ee" }}>{Math.round(payload[0].value).toLocaleString()} ml</p>
    </div>
  );
}
function CaffeineTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TT_STYLE}>
      <p style={{ fontWeight: 600, marginBottom: 2 }}>{label}</p>
      <p style={{ color: "#b45309" }}>{Math.round(payload[0].value)} mg</p>
    </div>
  );
}

interface Props {
  dailyWater: DailyWater[];
  dailyCaffeine: DailyCaffeine[];
  targetWater: number;
  targetCaffeine: number;
}

export function HydrationWeeklyCard({ dailyWater, dailyCaffeine, targetWater, targetCaffeine }: Props) {
  const todayIdx = dailyWater.length - 1;
  const waterData = dailyWater.map((d, i) => ({
    day: new Date(d.date + "T00:00:00").toLocaleDateString("en", { weekday: "short" }),
    ml: Math.round(d.total_ml),
    isToday: i === todayIdx,
  }));
  const caffData = dailyCaffeine.map((d, i) => ({
    day: new Date(d.date + "T00:00:00").toLocaleDateString("en", { weekday: "short" }),
    mg: Math.round(d.total_mg),
    isToday: i === dailyCaffeine.length - 1,
  }));

  const hasWater = waterData.some(d => d.ml > 0);
  const hasCaff = caffData.some(d => d.mg > 0);

  if (!hasWater && !hasCaff) {
    return (
      <DashboardCard title="Hydration & Caffeine">
        <p className="text-sm text-muted-foreground py-6 text-center">No data this week</p>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title="Hydration & Caffeine">
      <div className="space-y-5">
        {hasWater && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Water</p>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={waterData} barCategoryGap="20%">
                <defs>
                  <linearGradient id="waterBarToday" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="waterBarDim" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.15} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="day" tick={TICK} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<WaterTooltip />} cursor={{ fill: CURSOR_FILL }} />
                <ReferenceLine y={targetWater} stroke="#06b6d4" strokeDasharray="6 3" strokeWidth={1.5} strokeOpacity={0.5} />
                <Bar dataKey="ml" radius={[4, 4, 0, 0]} animationDuration={600} animationEasing="ease-out">
                  {waterData.map((entry, i) => (
                    <Cell key={i} fill={entry.isToday ? "url(#waterBarToday)" : "url(#waterBarDim)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {hasCaff && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Caffeine</p>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={caffData} barCategoryGap="20%">
                <defs>
                  <linearGradient id="caffBarToday" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#b45309" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#92400e" stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="caffBarDim" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#92400e" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#92400e" stopOpacity={0.15} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="day" tick={TICK} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<CaffeineTooltip />} cursor={{ fill: CURSOR_FILL }} />
                <ReferenceLine y={targetCaffeine} stroke="#b45309" strokeDasharray="6 3" strokeWidth={1.5} strokeOpacity={0.5} />
                <Bar dataKey="mg" radius={[4, 4, 0, 0]} animationDuration={600} animationEasing="ease-out">
                  {caffData.map((entry, i) => (
                    <Cell key={i} fill={entry.isToday ? "url(#caffBarToday)" : "url(#caffBarDim)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
