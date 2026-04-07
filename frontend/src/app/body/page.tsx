"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, LineChart, Line, ComposedChart,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
  ReferenceLine, Legend,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard-layout";
import { apiFetch } from "@/lib/api";
import { fmt, rnd } from "@/lib/utils";
import type { StatsSummary, UserSettings, BodyCompEntry } from "@/lib/types";

/* ─── Helpers ─── */

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDateFull(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function nthTickFormatter(data: { date: string }[], maxLabels = 8) {
  const interval = Math.max(1, Math.floor(data.length / maxLabels));
  return (_value: string, index: number) => {
    if (index % interval !== 0) return "";
    return fmtDate(data[index]?.date ?? _value);
  };
}

function rollingAvg<T extends Record<string, any>>(data: T[], key: string, window: number = 7): (T & Record<string, any>)[] {
  return data.map((d, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1).filter(x => x[key] != null);
    const avg = slice.length > 0 ? slice.reduce((sum: number, x: any) => sum + x[key], 0) / slice.length : null;
    return { ...d, [`${key}_avg`]: avg != null ? rnd(avg, 1) : null };
  });
}

/* ─── Chart Style Constants ─── */

const GRID_STROKE = "#2a2a30";
const GRID_DASH = "3 3";
const TICK_X = { fill: "#888", fontSize: 10 };
const TICK_Y = { fill: "#aaa", fontSize: 11 };
const TT_STYLE: React.CSSProperties = {
  backgroundColor: "#1e1e22",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#e8e8e8",
  padding: 12,
  borderRadius: 10,
  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  fontSize: 12,
};

const COLORS = {
  green: "#22c55e",
  greenLight: "#4ade80",
  blue: "#4f9cf9",
  amber: "#f9c74f",
  red: "#f94f4f",
  purple: "#a78bfa",
  orange: "#f97316",
};

/* ─── Preset Days ─── */

const PRESETS = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "60d", days: 60 },
  { label: "90d", days: 90 },
  { label: "180d", days: 180 },
  { label: "1y", days: 365 },
];

/* ─── Tooltip Components ─── */

function ChartTooltip({ active, payload, label, valueSuffix = "", valueKey }: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color?: string }>;
  label?: string;
  valueSuffix?: string;
  valueKey?: string;
}) {
  if (!active || !payload?.length) return null;
  const item = valueKey ? payload.find(p => p.dataKey === valueKey) ?? payload[0] : payload[0];
  return (
    <div style={TT_STYLE}>
      <p style={{ color: "#999", fontSize: 11, marginBottom: 4 }}>{fmtDateFull(label ?? "")}</p>
      <p style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>
        {typeof item.value === "number" ? fmt(item.value) : "--"}{valueSuffix}
      </p>
    </div>
  );
}

function MultiLineTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color?: string; name?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TT_STYLE}>
      <p style={{ color: "#999", fontSize: 11, marginBottom: 6 }}>{fmtDateFull(label ?? "")}</p>
      {payload.filter(p => typeof p.value === "number").map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: p.color }} />
          <span style={{ color: "#ccc", fontSize: 12 }}>{p.name ?? p.dataKey}:</span>
          <span style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>
            {fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Section Card ─── */

function SectionCard({ title, span = "", children, className = "" }: {
  title: string;
  span?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`clay-card p-5 ${span} ${className}`}>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}

/* ─── Loading Skeleton ─── */

function Skeleton() {
  return (
    <DashboardLayout title="Body Composition">
      <div className="space-y-6">
        <div className="clay-card p-5 h-12 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="clay-card p-4 h-20 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="clay-card p-5 h-72 lg:col-span-2 animate-pulse" />
          <div className="clay-card p-5 h-72 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="clay-card p-5 h-64 animate-pulse" />
          ))}
        </div>
        <div className="clay-card p-5 h-72 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="clay-card p-5 h-48 lg:col-span-2 animate-pulse" />
          <div className="clay-card p-5 h-48 animate-pulse" />
        </div>
      </div>
    </DashboardLayout>
  );
}

/* ─── Main Page ─── */

export default function BodyCompositionPage() {
  const [data, setData] = useState<StatsSummary | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [days, setDays] = useState(90);
  const [activePreset, setActivePreset] = useState(90);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<StatsSummary>(`/api/dashboard/stats?days=${days}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => {
    apiFetch<UserSettings>("/api/settings").then(setSettings).catch(() => {});
  }, []);

  function applyCustomRange() {
    if (!customFrom || !customTo) return;
    const from = new Date(customFrom);
    const to = new Date(customTo);
    const diff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    if (diff > 0) {
      setActivePreset(0);
      setDays(diff);
    }
  }

  /* ─── Derived data ─── */

  const weightHistory = data?.weight_history ?? [];

  const enrichedData = useMemo(() => {
    let d = rollingAvg(weightHistory, "weight_kg", 7);
    d = rollingAvg(d, "body_fat_pct", 7);
    d = rollingAvg(d, "muscle_mass_pct", 7);
    d = rollingAvg(d, "body_fat_kg", 7);
    d = rollingAvg(d, "muscle_mass_kg", 7);
    return d;
  }, [weightHistory]);

  const validWeights = weightHistory.filter(e => e.weight_kg != null);
  const firstWeight = validWeights.length > 0 ? validWeights[0] : null;
  const lastWeight = validWeights.length > 0 ? validWeights[validWeights.length - 1] : null;

  const currentWeight = lastWeight?.weight_kg ?? null;
  const startingWeight = firstWeight?.weight_kg ?? null;
  const weightChange = currentWeight != null && startingWeight != null ? Math.round((currentWeight - startingWeight) * 10) / 10 : null;
  const lowestWeight = validWeights.length > 0 ? Math.min(...validWeights.map(e => e.weight_kg)) : null;
  const highestWeight = validWeights.length > 0 ? Math.max(...validWeights.map(e => e.weight_kg)) : null;

  const validBf = weightHistory.filter(e => e.body_fat_pct != null);
  const currentBf = validBf.length > 0 ? validBf[validBf.length - 1].body_fat_pct : null;

  const validMuscle = weightHistory.filter(e => e.muscle_mass_pct != null);
  const currentMuscle = validMuscle.length > 0 ? validMuscle[validMuscle.length - 1].muscle_mass_pct : null;

  const validFatKg = weightHistory.filter(e => e.body_fat_kg != null);
  const currentFatKg = validFatKg.length > 0 ? validFatKg[validFatKg.length - 1].body_fat_kg : null;
  const startFatKg = validFatKg.length > 0 ? validFatKg[0].body_fat_kg : null;
  const fatKgChange = currentFatKg != null && startFatKg != null ? Math.round((currentFatKg - startFatKg) * 10) / 10 : null;

  const validMuscleKg = weightHistory.filter(e => e.muscle_mass_kg != null);
  const currentMuscleKg = validMuscleKg.length > 0 ? validMuscleKg[validMuscleKg.length - 1].muscle_mass_kg : null;
  const startMuscleKg = validMuscleKg.length > 0 ? validMuscleKg[0].muscle_mass_kg : null;
  const muscleKgChange = currentMuscleKg != null && startMuscleKg != null ? Math.round((currentMuscleKg - startMuscleKg) * 10) / 10 : null;

  const bmi = currentWeight != null ? Math.round((currentWeight / (1.75 * 1.75)) * 10) / 10 : null;

  const weeksInPeriod = days / 7;
  const weeklyAvgChange = weightChange != null && weeksInPeriod > 0
    ? Math.round((weightChange / weeksInPeriod) * 100) / 100
    : null;

  // Targets
  const targetWeight = 78;
  const targetBf = 15;

  // Body composition donut data
  const compositionDonut = useMemo(() => {
    if (currentBf == null && currentMuscle == null) return [];
    const fat = currentBf ?? 0;
    const muscle = currentMuscle ?? 0;
    const other = Math.max(0, 100 - fat - muscle);
    return [
      { name: "Body Fat", value: fat, color: COLORS.amber },
      { name: "Muscle", value: muscle, color: COLORS.blue },
      { name: "Other", value: other, color: "#444" },
    ];
  }, [currentBf, currentMuscle]);

  // Weekly rate of change data
  const weeklyRateData = useMemo(() => {
    if (validWeights.length < 8) return [];
    const rates: { date: string; rate: number }[] = [];
    for (let i = 7; i < validWeights.length; i++) {
      const current = validWeights[i].weight_kg;
      const prev = validWeights[i - 7].weight_kg;
      rates.push({
        date: validWeights[i].date,
        rate: Math.round((current - prev) * 100) / 100,
      });
    }
    return rates;
  }, [validWeights]);

  if (loading && !data) return <Skeleton />;

  return (
    <DashboardLayout title="Body Composition">
      <div className="space-y-6">
        {/* ─── Header + Date Picker ─── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 -mt-4">
          <p className="text-sm text-muted-foreground">Track weight, body fat, and muscle trends</p>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.days}
                onClick={() => { setActivePreset(p.days); setDays(p.days); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 ${
                  activePreset === p.days
                    ? "pill-green text-primary"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
            <div className="flex items-center gap-1.5 ml-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-secondary text-foreground text-xs rounded-lg px-2 py-1.5 border border-border"
              />
              <span className="text-muted-foreground text-xs">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-secondary text-foreground text-xs rounded-lg px-2 py-1.5 border border-border"
              />
              <button
                onClick={applyCustomRange}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                Go
              </button>
            </div>
          </div>
        </div>

        {/* ─── Row 1: Hero metric pills ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="clay-card p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Weight</p>
            <p className="text-xl font-bold text-foreground">
              {currentWeight != null ? `${fmt(currentWeight)} kg` : "--"}
            </p>
          </div>
          <div className="clay-card p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Change</p>
            <p className={`text-xl font-bold ${weightChange != null && weightChange < 0 ? "text-green-400" : weightChange != null && weightChange > 0 ? "text-amber-400" : "text-foreground"}`}>
              {weightChange != null ? `${weightChange > 0 ? "+" : ""}${fmt(weightChange)} kg` : "--"}
            </p>
          </div>
          <div className="clay-card p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Body Fat</p>
            <p className="text-xl font-bold" style={{ color: COLORS.amber }}>
              {currentBf != null ? `${fmt(currentBf)}%` : "--"}
            </p>
            {currentFatKg != null && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{fmt(currentFatKg)} kg</p>
            )}
          </div>
          <div className="clay-card p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Fat Change</p>
            <p className={`text-xl font-bold ${fatKgChange != null && fatKgChange < 0 ? "text-green-400" : fatKgChange != null && fatKgChange > 0 ? "text-amber-400" : "text-foreground"}`}>
              {fatKgChange != null ? `${fatKgChange > 0 ? "+" : ""}${fmt(fatKgChange)} kg` : "--"}
            </p>
          </div>
          <div className="clay-card p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Muscle</p>
            <p className="text-xl font-bold" style={{ color: COLORS.blue }}>
              {currentMuscle != null ? `${fmt(currentMuscle)}%` : "--"}
            </p>
            {currentMuscleKg != null && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{fmt(currentMuscleKg)} kg</p>
            )}
          </div>
          <div className="clay-card p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Muscle Change</p>
            <p className={`text-xl font-bold ${muscleKgChange != null && muscleKgChange > 0 ? "text-green-400" : muscleKgChange != null && muscleKgChange < 0 ? "text-amber-400" : "text-foreground"}`}>
              {muscleKgChange != null ? `${muscleKgChange > 0 ? "+" : ""}${fmt(muscleKgChange)} kg` : "--"}
            </p>
          </div>
          <div className="clay-card p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">BMI</p>
            <p className="text-xl font-bold text-foreground">
              {bmi != null ? fmt(bmi) : "--"}
            </p>
          </div>
          <div className="clay-card p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Weekly Avg</p>
            <p className={`text-xl font-bold ${weeklyAvgChange != null && weeklyAvgChange < 0 ? "text-green-400" : weeklyAvgChange != null && weeklyAvgChange > 0 ? "text-amber-400" : "text-foreground"}`}>
              {weeklyAvgChange != null ? `${weeklyAvgChange > 0 ? "+" : ""}${fmt(weeklyAvgChange, 2)} kg/w` : "--"}
            </p>
          </div>
        </div>

        {/* ─── Row 2: Weight Trend + Weight Stats ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SectionCard title="Weight Trend" span="lg:col-span-2">
            {enrichedData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={enrichedData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.green} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={COLORS.green} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray={GRID_DASH} />
                  <XAxis dataKey="date" tickFormatter={nthTickFormatter(enrichedData)} tick={TICK_X} axisLine={false} tickLine={false} />
                  <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={TICK_Y} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip valueSuffix=" kg" valueKey="weight_kg_avg" />} />
                  <ReferenceLine y={targetWeight} stroke={COLORS.green} strokeDasharray="6 4" strokeOpacity={0.5} />
                  <Area type="monotone" dataKey="weight_kg" stroke="none" fill="url(#weightGrad)" fillOpacity={1} />
                  <Line type="monotone" dataKey="weight_kg" stroke={COLORS.green} strokeWidth={0} dot={{ r: 2, fill: COLORS.green, fillOpacity: 0.3, strokeWidth: 0 }} activeDot={false} />
                  <Line type="monotone" dataKey="weight_kg_avg" stroke={COLORS.green} strokeWidth={2.5} dot={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-12 text-center">No weight data for this period</p>
            )}
          </SectionCard>

          <SectionCard title="Weight Stats">
            <div className="space-y-3">
              {[
                { label: "Starting", value: startingWeight, unit: "kg", cls: "" },
                { label: "Current", value: currentWeight, unit: "kg", cls: "" },
                { label: "Lowest", value: lowestWeight, unit: "kg", cls: "text-green-400" },
                { label: "Highest", value: highestWeight, unit: "kg", cls: "text-amber-400" },
                { label: "Total Change", value: weightChange, unit: "kg", cls: weightChange != null && weightChange < 0 ? "text-green-400" : "text-amber-400" },
                { label: "Weekly Rate", value: weeklyAvgChange, unit: "kg/w", cls: weeklyAvgChange != null && weeklyAvgChange < 0 ? "text-green-400" : "text-amber-400" },
              ].map((s) => (
                <div key={s.label} className="pill flex items-center justify-between px-3 py-2">
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                  <span className={`text-sm font-semibold ${s.cls || "text-foreground"}`}>
                    {s.value != null ? `${fmt(s.value, s.unit === "kg/w" ? 2 : 1)} ${s.unit}` : "--"}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* ─── Row 3: Body Fat + Muscle Mass + Composition Donut ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SectionCard title="Body Fat % Trend">
            {enrichedData.some(d => d.body_fat_pct != null) ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={enrichedData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="bfGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.amber} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={COLORS.amber} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray={GRID_DASH} />
                  <XAxis dataKey="date" tickFormatter={nthTickFormatter(enrichedData, 5)} tick={TICK_X} axisLine={false} tickLine={false} />
                  <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={TICK_Y} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip valueSuffix="%" valueKey="body_fat_pct_avg" />} />
                  <Area type="monotone" dataKey="body_fat_pct" stroke="none" fill="url(#bfGrad)" fillOpacity={1} />
                  <Line type="monotone" dataKey="body_fat_pct" stroke={COLORS.amber} strokeWidth={0} dot={{ r: 2, fill: COLORS.amber, fillOpacity: 0.3, strokeWidth: 0 }} activeDot={false} connectNulls />
                  <Line type="monotone" dataKey="body_fat_pct_avg" stroke={COLORS.amber} strokeWidth={2.5} dot={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-12 text-center">No body fat data</p>
            )}
          </SectionCard>

          <SectionCard title="Muscle Mass % Trend">
            {enrichedData.some(d => d.muscle_mass_pct != null) ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={enrichedData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="muscleGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.blue} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={COLORS.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray={GRID_DASH} />
                  <XAxis dataKey="date" tickFormatter={nthTickFormatter(enrichedData, 5)} tick={TICK_X} axisLine={false} tickLine={false} />
                  <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={TICK_Y} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip valueSuffix="%" valueKey="muscle_mass_pct_avg" />} />
                  <Area type="monotone" dataKey="muscle_mass_pct" stroke="none" fill="url(#muscleGrad)" fillOpacity={1} />
                  <Line type="monotone" dataKey="muscle_mass_pct" stroke={COLORS.blue} strokeWidth={0} dot={{ r: 2, fill: COLORS.blue, fillOpacity: 0.3, strokeWidth: 0 }} activeDot={false} connectNulls />
                  <Line type="monotone" dataKey="muscle_mass_pct_avg" stroke={COLORS.blue} strokeWidth={2.5} dot={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-12 text-center">No muscle mass data</p>
            )}
          </SectionCard>

          <SectionCard title="Current Composition">
            {compositionDonut.length > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={compositionDonut}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {compositionDonut.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={TT_STYLE}
                      formatter={(value: any, name: any) => [`${fmt(value)}%`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-3 mt-2">
                  {compositionDonut.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="text-xs text-muted-foreground">{entry.name}</span>
                      <span className="text-xs font-semibold text-foreground">{fmt(entry.value)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-12 text-center">No composition data</p>
            )}
          </SectionCard>
        </div>

        {/* ─── Row 3b: Fat kg + Muscle kg Trends ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Fat Mass (kg)">
            {enrichedData.some(d => d.body_fat_kg != null) ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={enrichedData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fatKgGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.amber} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={COLORS.amber} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray={GRID_DASH} />
                  <XAxis dataKey="date" tickFormatter={nthTickFormatter(enrichedData, 6)} tick={TICK_X} axisLine={false} tickLine={false} />
                  <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={TICK_Y} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip valueSuffix=" kg" valueKey="body_fat_kg_avg" />} />
                  <Area type="monotone" dataKey="body_fat_kg" stroke="none" fill="url(#fatKgGrad)" fillOpacity={1} />
                  <Line type="monotone" dataKey="body_fat_kg" stroke={COLORS.amber} strokeWidth={0} dot={{ r: 2, fill: COLORS.amber, fillOpacity: 0.3, strokeWidth: 0 }} activeDot={false} connectNulls />
                  <Line type="monotone" dataKey="body_fat_kg_avg" stroke={COLORS.amber} strokeWidth={2.5} dot={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-12 text-center">No fat mass data</p>
            )}
          </SectionCard>

          <SectionCard title="Muscle Mass (kg)">
            {enrichedData.some(d => d.muscle_mass_kg != null) ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={enrichedData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="muscleKgGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.blue} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={COLORS.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray={GRID_DASH} />
                  <XAxis dataKey="date" tickFormatter={nthTickFormatter(enrichedData, 6)} tick={TICK_X} axisLine={false} tickLine={false} />
                  <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={TICK_Y} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip valueSuffix=" kg" valueKey="muscle_mass_kg_avg" />} />
                  <Area type="monotone" dataKey="muscle_mass_kg" stroke="none" fill="url(#muscleKgGrad)" fillOpacity={1} />
                  <Line type="monotone" dataKey="muscle_mass_kg" stroke={COLORS.blue} strokeWidth={0} dot={{ r: 2, fill: COLORS.blue, fillOpacity: 0.3, strokeWidth: 0 }} activeDot={false} connectNulls />
                  <Line type="monotone" dataKey="muscle_mass_kg_avg" stroke={COLORS.blue} strokeWidth={2.5} dot={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-12 text-center">No muscle mass data</p>
            )}
          </SectionCard>
        </div>

        {/* ─── Row 4: Combined progress chart ─── */}
        <SectionCard title="Progress Overview" span="lg:col-span-3">
          {enrichedData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={enrichedData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray={GRID_DASH} />
                <XAxis dataKey="date" tickFormatter={nthTickFormatter(enrichedData)} tick={TICK_X} axisLine={false} tickLine={false} />
                <YAxis yAxisId="weight" orientation="left" domain={["dataMin - 2", "dataMax + 2"]} tick={TICK_Y} axisLine={false} tickLine={false} label={{ value: "kg", position: "insideTopLeft", fill: "#666", fontSize: 10 }} />
                <YAxis yAxisId="pct" orientation="right" domain={["dataMin - 2", "dataMax + 2"]} tick={TICK_Y} axisLine={false} tickLine={false} label={{ value: "%", position: "insideTopRight", fill: "#666", fontSize: 10 }} />
                <Tooltip content={<MultiLineTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, color: "#aaa" }}
                />
                <Line yAxisId="weight" type="monotone" dataKey="weight_kg_avg" name="Weight (kg)" stroke={COLORS.green} strokeWidth={2} dot={false} connectNulls />
                <Line yAxisId="pct" type="monotone" dataKey="body_fat_pct_avg" name="Body Fat (%)" stroke={COLORS.amber} strokeWidth={2} dot={false} connectNulls />
                <Line yAxisId="pct" type="monotone" dataKey="muscle_mass_pct_avg" name="Muscle (%)" stroke={COLORS.blue} strokeWidth={2} dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-12 text-center">No data for this period</p>
          )}
        </SectionCard>

        {/* ─── Row 5: Milestones + Rate of Change ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SectionCard title="Milestones" span="lg:col-span-2">
            <div className="space-y-5">
              {/* Weight progress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Weight</span>
                  <span className="text-xs font-medium text-foreground">
                    {currentWeight != null ? `${fmt(currentWeight)} kg` : "--"} / {targetWeight} kg
                  </span>
                </div>
                {currentWeight != null && startingWeight != null ? (() => {
                  const totalNeeded = startingWeight - targetWeight;
                  const achieved = startingWeight - currentWeight;
                  const pct = totalNeeded !== 0 ? Math.max(0, Math.min(100, Math.round((achieved / totalNeeded) * 100))) : 0;
                  return (
                    <>
                      <div className="w-full h-3 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${COLORS.green}, ${COLORS.greenLight})`,
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{pct}% of goal reached</p>
                    </>
                  );
                })() : (
                  <div className="w-full h-3 rounded-full bg-secondary" />
                )}
              </div>

              {/* Body fat progress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Body Fat</span>
                  <span className="text-xs font-medium text-foreground">
                    {currentBf != null ? `${fmt(currentBf)}%` : "--"} / {targetBf}%
                  </span>
                </div>
                {currentBf != null && validBf.length > 0 ? (() => {
                  const startBf = validBf[0].body_fat_pct ?? currentBf;
                  const totalNeeded = startBf - targetBf;
                  const achieved = startBf - currentBf;
                  const pct = totalNeeded !== 0 ? Math.max(0, Math.min(100, Math.round((achieved / totalNeeded) * 100))) : 0;
                  return (
                    <>
                      <div className="w-full h-3 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${COLORS.amber}, ${COLORS.orange})`,
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{pct}% of goal reached</p>
                    </>
                  );
                })() : (
                  <div className="w-full h-3 rounded-full bg-secondary" />
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Rate of Change">
            {weeklyRateData.length > 0 ? (
              <div className="space-y-3">
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={weeklyRateData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                    <CartesianGrid stroke={GRID_STROKE} strokeDasharray={GRID_DASH} />
                    <XAxis dataKey="date" tickFormatter={nthTickFormatter(weeklyRateData, 4)} tick={TICK_X} axisLine={false} tickLine={false} />
                    <YAxis tick={TICK_Y} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip valueSuffix=" kg/w" valueKey="rate" />} />
                    <ReferenceLine y={0} stroke="#555" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="rate" stroke={COLORS.purple} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="pill flex items-center justify-between px-3 py-2">
                  <span className="text-xs text-muted-foreground">Avg weekly rate</span>
                  <span className={`text-xs font-semibold ${weeklyAvgChange != null && weeklyAvgChange < 0 ? "text-green-400" : "text-amber-400"}`}>
                    {weeklyAvgChange != null ? `${weeklyAvgChange > 0 ? "+" : ""}${fmt(weeklyAvgChange, 2)} kg/w` : "--"}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-12 text-center">Need 8+ data points</p>
            )}
          </SectionCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
