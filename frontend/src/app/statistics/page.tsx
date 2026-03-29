"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine, Area, AreaChart,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard-layout";
import { DashboardCard } from "@/components/dashboard-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import type { StatsSummary } from "@/lib/types";

const CHART_GRID_STROKE = "var(--border)";
const CHART_TICK = { fill: "var(--muted-foreground)", fontSize: 9 };
const CHART_TICK_Y = { fill: "var(--muted-foreground)", fontSize: 10 };
const TOOLTIP_STYLE = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--foreground)",
  fontSize: 12,
};

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
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl bg-card border border-border p-5 space-y-3">
                <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                <div className="h-[200px] rounded-lg bg-muted/50 animate-pulse" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-2xl bg-card border border-border p-5 space-y-3">
                <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                <div className="h-[220px] rounded-lg bg-muted/50 animate-pulse" />
              </div>
            ))}
          </div>
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
    { name: "Protein", value: Math.round((data.macro_avg.protein / macroTotal) * 100), fill: "var(--chart-2)" },
    { name: "Carbs", value: Math.round((data.macro_avg.carbs / macroTotal) * 100), fill: "var(--chart-1)" },
    { name: "Fat", value: Math.round((data.macro_avg.fat / macroTotal) * 100), fill: "var(--chart-4)" },
  ] : [];

  return (
    <DashboardLayout title="Statistics">
      {/* Range picker */}
      <div className="mb-4">
        <Tabs
          defaultValue={String(days)}
          onValueChange={(val: string | number | null) => val && setDays(Number(val))}
        >
          <TabsList>
            {[30, 60, 90].map((d) => (
              <TabsTrigger key={d} value={String(d)}>
                {d}d
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-4">
        {/* Row 1: Weight + Body Fat + Muscle */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <DashboardCard title="Weight History">
            {weightData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No weight data</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={weightData}>
                  <defs>
                    <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--foreground)" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="var(--foreground)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
                  <XAxis dataKey="date" tick={CHART_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={CHART_TICK_Y} axisLine={false} tickLine={false} width={35} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <ReferenceLine y={78} stroke="var(--primary)" strokeDasharray="6 3" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="weight_kg" stroke="var(--foreground)" strokeWidth={2} fill="url(#wg)" dot={{ fill: "var(--foreground)", r: 2, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </DashboardCard>

          <DashboardCard title="Body Fat %">
            {fatData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No body fat data</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={fatData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
                  <XAxis dataKey="date" tick={CHART_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={CHART_TICK_Y} axisLine={false} tickLine={false} width={30} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="body_fat_pct" stroke="var(--chart-4)" strokeWidth={2} dot={{ fill: "var(--chart-4)", r: 2, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </DashboardCard>

          <DashboardCard title="Muscle Mass %">
            {muscleData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No muscle data</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={muscleData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
                  <XAxis dataKey="date" tick={CHART_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={CHART_TICK_Y} axisLine={false} tickLine={false} width={30} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="muscle_mass_pct" stroke="var(--chart-1)" strokeWidth={2} dot={{ fill: "var(--chart-1)", r: 2, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </DashboardCard>
        </div>

        {/* Row 2: Calorie Trend + Macro Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DashboardCard title="Calorie Trend">
            {data.daily_calories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No calorie data</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.daily_calories} barCategoryGap="15%">
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
                  <XAxis dataKey="date" tick={CHART_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={CHART_TICK_Y} axisLine={false} tickLine={false} width={40} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <ReferenceLine y={2000} stroke="var(--primary)" strokeDasharray="6 3" strokeWidth={1.5} />
                  <Bar dataKey="kcal" fill="var(--muted)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </DashboardCard>

          <DashboardCard title="Macro Distribution">
            {macroTotal === 0 ? (
              <p className="text-sm text-muted-foreground">No macro data</p>
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
                      <span className="text-sm text-muted-foreground">{m.name}</span>
                      <span className="text-sm font-bold tabular-nums text-foreground">{m.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DashboardCard>
        </div>

        {/* Row 3: Records, Consistency, Supplement Adherence */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <DashboardCard title="Personal Records">
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Highest Protein Day</p>
                {data.highest_protein_day ? (
                  <p className="text-lg font-bold tabular-nums text-primary">
                    {data.highest_protein_day.protein}g
                    <span className="text-xs font-normal text-muted-foreground/50 ml-1">{data.highest_protein_day.date}</span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">--</p>
                )}
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Lowest Calorie Day</p>
                {data.lowest_calorie_day ? (
                  <p className="text-lg font-bold tabular-nums text-blue-500">
                    {data.lowest_calorie_day.kcal} kcal
                    <span className="text-xs font-normal text-muted-foreground/50 ml-1">{data.lowest_calorie_day.date}</span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">--</p>
                )}
              </div>
            </div>
          </DashboardCard>

          <DashboardCard title="Consistency">
            <div className="flex flex-col items-center justify-center flex-1 gap-2">
              <div className="relative h-[100px] w-[100px]">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--muted)" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="40" fill="none" stroke="var(--primary)" strokeWidth="8"
                    strokeDasharray={`${(data.days_logged / data.total_days) * 251.3} 251.3`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold tabular-nums text-foreground">
                    {Math.round((data.days_logged / data.total_days) * 100)}%
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {data.days_logged} of {data.total_days} days logged
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="text-sm font-semibold text-foreground tabular-nums">{data.current_streak} day streak</span>
              </div>
            </div>
          </DashboardCard>

          <DashboardCard title="Supplement Adherence">
            <div className="flex flex-col items-center justify-center flex-1 gap-2">
              <div className="relative h-[100px] w-[100px]">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--muted)" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="40" fill="none"
                    stroke={data.supplement_adherence_pct >= 80 ? "var(--primary)" : data.supplement_adherence_pct >= 50 ? "var(--chart-4)" : "var(--destructive)"}
                    strokeWidth="8"
                    strokeDasharray={`${(data.supplement_adherence_pct / 100) * 251.3} 251.3`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold tabular-nums text-foreground">
                    {Math.round(data.supplement_adherence_pct)}%
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Days with supplements taken
              </p>
            </div>
          </DashboardCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
