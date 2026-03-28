"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine, Area, AreaChart,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard-layout";
import { DashboardCard } from "@/components/dashboard-card";
import { apiFetch } from "@/lib/api";
import type { StatsSummary } from "@/lib/types";

export default function StatisticsPage() {
  const [data, setData] = useState<StatsSummary | null>(null);
  const [days, setDays] = useState(90);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<StatsSummary>(`/api/dashboard/stats?days=${days}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  if (loading || !data) {
    return (
      <DashboardLayout title="Statistics">
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#22c55e] border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  const weightData = data.weight_history;
  const fatData = weightData.filter((d) => d.body_fat_pct != null);
  const muscleData = weightData.filter((d) => d.muscle_mass_pct != null);

  // Macro distribution pie
  const macroTotal = data.macro_avg.protein + data.macro_avg.carbs + data.macro_avg.fat;
  const macroPie = macroTotal > 0 ? [
    { name: "Protein", value: Math.round((data.macro_avg.protein / macroTotal) * 100), fill: "#22c55e" },
    { name: "Carbs", value: Math.round((data.macro_avg.carbs / macroTotal) * 100), fill: "#3b82f6" },
    { name: "Fat", value: Math.round((data.macro_avg.fat / macroTotal) * 100), fill: "#f59e0b" },
  ] : [];

  return (
    <DashboardLayout title="Statistics">
      {/* Range picker */}
      <div className="flex gap-2 mb-4">
        {[30, 60, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              days === d ? "bg-[#22c55e]/10 text-[#22c55e]" : "text-white/30 hover:bg-white/5"
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {/* Row 1: Weight + Body Fat + Muscle */}
        <div className="grid grid-cols-3 gap-4">
          <DashboardCard title="Weight History">
            {weightData.length === 0 ? (
              <p className="text-sm text-white/30">No weight data</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={weightData}>
                  <defs>
                    <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffffff" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} width={35} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#e8e8e8", fontSize: 12 }} />
                  <ReferenceLine y={78} stroke="#22c55e" strokeDasharray="6 3" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="weight_kg" stroke="#ffffff" strokeWidth={2} fill="url(#wg)" dot={{ fill: "#fff", r: 2, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </DashboardCard>

          <DashboardCard title="Body Fat %">
            {fatData.length === 0 ? (
              <p className="text-sm text-white/30">No body fat data</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={fatData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} width={30} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#e8e8e8", fontSize: 12 }} />
                  <Line type="monotone" dataKey="body_fat_pct" stroke="#f59e0b" strokeWidth={2} dot={{ fill: "#f59e0b", r: 2, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </DashboardCard>

          <DashboardCard title="Muscle Mass %">
            {muscleData.length === 0 ? (
              <p className="text-sm text-white/30">No muscle data</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={muscleData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} width={30} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#e8e8e8", fontSize: 12 }} />
                  <Line type="monotone" dataKey="muscle_mass_pct" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 2, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </DashboardCard>
        </div>

        {/* Row 2: Calorie Trend + Macro Distribution */}
        <div className="grid grid-cols-2 gap-4">
          <DashboardCard title="Calorie Trend">
            {data.daily_calories.length === 0 ? (
              <p className="text-sm text-white/30">No calorie data</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.daily_calories} barCategoryGap="15%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#e8e8e8", fontSize: 12 }} />
                  <ReferenceLine y={2000} stroke="#22c55e" strokeDasharray="6 3" strokeWidth={1.5} />
                  <Bar dataKey="kcal" fill="rgba(255,255,255,0.15)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </DashboardCard>

          <DashboardCard title="Macro Distribution">
            {macroTotal === 0 ? (
              <p className="text-sm text-white/30">No macro data</p>
            ) : (
              <div className="flex items-center gap-6">
                <div className="w-[160px] h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={macroPie} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" stroke="none">
                        {macroPie.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {macroPie.map((m) => (
                    <div key={m.name} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: m.fill }} />
                      <span className="text-sm text-white/70">{m.name}</span>
                      <span className="text-sm font-bold tabular-nums text-white">{m.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DashboardCard>
        </div>

        {/* Row 3: Records, Consistency, Supplement Adherence */}
        <div className="grid grid-cols-3 gap-4">
          <DashboardCard title="Personal Records">
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-wide">Highest Protein Day</p>
                {data.highest_protein_day ? (
                  <p className="text-lg font-bold tabular-nums text-[#22c55e]">
                    {data.highest_protein_day.protein}g
                    <span className="text-xs font-normal text-white/25 ml-1">{data.highest_protein_day.date}</span>
                  </p>
                ) : (
                  <p className="text-sm text-white/30">—</p>
                )}
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-wide">Lowest Calorie Day</p>
                {data.lowest_calorie_day ? (
                  <p className="text-lg font-bold tabular-nums text-[#3b82f6]">
                    {data.lowest_calorie_day.kcal} kcal
                    <span className="text-xs font-normal text-white/25 ml-1">{data.lowest_calorie_day.date}</span>
                  </p>
                ) : (
                  <p className="text-sm text-white/30">—</p>
                )}
              </div>
            </div>
          </DashboardCard>

          <DashboardCard title="Consistency">
            <div className="flex flex-col items-center justify-center flex-1 gap-2">
              <div className="relative h-[100px] w-[100px]">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#1f1f23" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="40" fill="none" stroke="#22c55e" strokeWidth="8"
                    strokeDasharray={`${(data.days_logged / data.total_days) * 251.3} 251.3`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold tabular-nums text-white">
                    {Math.round((data.days_logged / data.total_days) * 100)}%
                  </span>
                </div>
              </div>
              <p className="text-xs text-white/40">
                {data.days_logged} of {data.total_days} days logged
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="h-2 w-2 rounded-full bg-[#22c55e] animate-pulse" />
                <span className="text-sm font-semibold text-white tabular-nums">{data.current_streak} day streak</span>
              </div>
            </div>
          </DashboardCard>

          <DashboardCard title="Supplement Adherence">
            <div className="flex flex-col items-center justify-center flex-1 gap-2">
              <div className="relative h-[100px] w-[100px]">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#1f1f23" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="40" fill="none"
                    stroke={data.supplement_adherence_pct >= 80 ? "#22c55e" : data.supplement_adherence_pct >= 50 ? "#f59e0b" : "#ef4444"}
                    strokeWidth="8"
                    strokeDasharray={`${(data.supplement_adherence_pct / 100) * 251.3} 251.3`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold tabular-nums text-white">
                    {Math.round(data.supplement_adherence_pct)}%
                  </span>
                </div>
              </div>
              <p className="text-xs text-white/40">
                Days with supplements taken
              </p>
            </div>
          </DashboardCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
