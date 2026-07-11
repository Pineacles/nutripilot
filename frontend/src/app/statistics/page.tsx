"use client";

import { useMemo, useState } from "react";
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
  ReferenceLine, Area, AreaChart, Legend,
  ComposedChart,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useStats, useSettings } from "@/hooks/queries";
import { getErrorMessage } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { ErrorState } from "@/components/ui/error-state";

/* ─── Helpers ─── */

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDateFull(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateAxis(dateStr: string, dataLength: number): string {
  const d = new Date(dateStr + "T00:00:00");
  if (dataLength > 90) {
    return d.toLocaleDateString("en-US", { month: "short" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function computeAxisInterval(dataLength: number): number {
  if (dataLength <= 14) return 0;
  if (dataLength <= 30) return 2;
  if (dataLength <= 90) return 6;
  return 13;
}

function nthTickFormatter(data: { date: string }[], maxLabels = 8) {
  const interval = Math.max(1, Math.floor(data.length / maxLabels));
  return (_value: string, index: number) => {
    if (index % interval !== 0) return "";
    return fmtDate(data[index]?.date ?? _value);
  };
}

interface DailyNutritionLike {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  alcohol: number;
  date: string;
  [key: string]: unknown;
}

function computeRollingAvg<T extends DailyNutritionLike>(data: T[], keys: (keyof DailyNutritionLike)[], windowSize: number = 7): (T & Record<string, number>)[] {
  return data.map((d, i) => {
    const start = Math.max(0, i - windowSize + 1);
    const slice = data.slice(start, i + 1);
    const avgs: Record<string, number> = {};
    for (const key of keys) {
      const avg = slice.reduce((sum, x) => sum + (Number(x[key]) || 0), 0) / slice.length;
      avgs[`avg_${String(key)}`] = Math.round(avg);
    }
    return { ...d, ...avgs } as T & Record<string, number>;
  });
}

/* ─── Chart Style Constants ─── */

const GRID_STROKE = "rgba(255,255,255,0.06)";
const GRID_DASH = "3 3";
const TICK_X = { fill: "#888", fontSize: 10 };
const TICK_Y = { fill: "#aaa", fontSize: 11 };
const TT_STYLE: React.CSSProperties = {
  backgroundColor: "#1e1e22",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  color: "#e8e8e8",
  fontSize: 13,
  padding: "10px 14px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
};
const TT_LABEL_STYLE: React.CSSProperties = { color: "#aaa", fontSize: 11, marginBottom: 4 };
const TT_ITEM_STYLE: React.CSSProperties = { color: "#e8e8e8", fontSize: 13 };

const COLORS = {
  green: "#22c55e",
  greenLight: "#4ade80",
  blue: "#4f9cf9",
  amber: "#f9c74f",
  red: "#f94f4f",
  purple: "#a78bfa",
  pink: "#ec4899",
  cyan: "#06b6d4",
  orange: "#f97316",
  teal: "#14b8a6",
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

/* ─── Custom Tooltip Component ─── */

function ChartTooltip({ active, payload, label, valueSuffix = "" }: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color?: string; name?: string }>;
  label?: string;
  valueSuffix?: string;
}) {
  if (!active || !payload?.length) return null;
  // Filter out raw data entries when rolling average is present
  const filtered = payload.filter(p => !p.dataKey.startsWith("avg_") || true);
  return (
    <div style={TT_STYLE}>
      <p style={TT_LABEL_STYLE}>{fmtDateFull(label ?? "")}</p>
      {filtered.map((p, i) => {
        // Skip raw data keys when we have the avg counterpart
        if (filtered.some(f => f.dataKey === `avg_${p.dataKey}`)) return null;
        return (
          <p key={i} style={{ ...TT_ITEM_STYLE, fontWeight: 700, marginBottom: 2 }}>
            {p.name ?? p.dataKey}: {typeof p.value === "number" ? fmt(p.value) : p.value}{valueSuffix}
          </p>
        );
      })}
    </div>
  );
}

function MultiLineTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color?: string; name?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  // Show rolling avg entries; skip raw entries that have a corresponding avg
  const visible = payload.filter(p => {
    if (payload.some(other => other.dataKey === `avg_${p.dataKey}`)) return false;
    return true;
  });
  return (
    <div style={TT_STYLE}>
      <p style={TT_LABEL_STYLE}>{fmtDateFull(label ?? "")}</p>
      {visible.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: p.color }} />
          <span style={{ ...TT_ITEM_STYLE, color: "#ccc" }}>{(p.name ?? p.dataKey).replace(/^avg_/, "")}:</span>
          <span style={{ ...TT_ITEM_STYLE, fontWeight: 600 }}>
            {typeof p.value === "number" ? fmt(p.value) : "--"}
          </span>
        </div>
      ))}
    </div>
  );
}

/* (SupplementHeatmap removed — replaced with Recharts-based chart inline) */

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

/* ─── Main Page ─── */

export default function StatisticsPage() {
  const [days, setDays] = useState(90);
  const [activePreset, setActivePreset] = useState(90);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [macroTab, setMacroTab] = useState<"protein" | "carbs" | "fat" | "all">("all");

  const { data, isLoading: loading, isError, error, refetch } = useStats(days);
  const { data: settings } = useSettings();

  // Custom date range handler
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

  // Derived targets
  const targetKcal = settings?.nutrition_targets?.target_kcal ?? 2200;
  const targetProtein = settings?.nutrition_targets?.target_protein_g ?? 150;
  const targetCarbs = settings?.nutrition_targets?.target_carbs_g ?? 250;
  const targetFat = settings?.nutrition_targets?.target_fat_g ?? 70;
  const targetFiber = settings?.nutrition_targets?.target_fiber_g ?? 30;
  const targetSugar = settings?.nutrition_targets?.target_sugar_g ?? 50;
  const targetSodium = settings?.nutrition_targets?.target_sodium_mg ?? 2300;
  const targetAlcohol = settings?.nutrition_targets?.target_alcohol_g ?? 0;
  const targetWaterMl = settings?.nutrition_targets?.target_water_ml ?? 2500;
  const targetCaffeineMg = settings?.nutrition_targets?.target_caffeine_mg ?? 400;
  // Nullable — goal reference line is hidden entirely when no goal weight is set.
  const targetWeight = settings?.nutrition_targets?.target_weight_kg ?? null;

  // Macro distribution pie data
  const macroPie = useMemo(() => {
    if (!data) return [];
    const total = data.macro_avg.protein + data.macro_avg.carbs + data.macro_avg.fat;
    if (total === 0) return [];
    return [
      { name: "Protein", value: Math.round((data.macro_avg.protein / total) * 100), grams: Math.round(data.macro_avg.protein), fill: COLORS.blue },
      { name: "Carbs", value: Math.round((data.macro_avg.carbs / total) * 100), grams: Math.round(data.macro_avg.carbs), fill: COLORS.green },
      { name: "Fat", value: Math.round((data.macro_avg.fat / total) * 100), grams: Math.round(data.macro_avg.fat), fill: COLORS.amber },
    ];
  }, [data]);

  /* ─── Error / Loading States ─── */

  if (isError && !data) {
    return (
      <DashboardLayout title="Analytics">
        <ErrorState message={getErrorMessage(error, "Couldn't load analytics data.")} onRetry={() => refetch()} />
      </DashboardLayout>
    );
  }

  if (loading || !data) {
    return (
      <DashboardLayout title="Analytics">
        <div className="space-y-4">
          <div className="flex gap-2 mb-4">
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <div key={i} className="h-9 w-12 rounded-full bg-muted animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="clay-card p-4 space-y-2">
                <div className="h-3 w-16 rounded bg-muted animate-pulse" />
                <div className="h-8 w-20 rounded bg-muted/50 animate-pulse" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className={`clay-card p-5 space-y-3 ${i <= 2 ? "lg:col-span-2" : ""}`}>
                <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                <div className="h-[200px] rounded-lg bg-muted/50 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const weightData = data.weight_history ?? [];
  const bodyCompData = weightData.filter(d => d.body_fat_pct != null || d.muscle_mass_pct != null);
  const nutrition = data.daily_nutrition ?? [];
  const rollingNutrition = computeRollingAvg(nutrition as DailyNutritionLike[], ["kcal", "protein", "carbs", "fat", "fiber", "sugar", "sodium", "alcohol"]);
  const avgKcal = data.avg_daily_kcal ?? (nutrition.length > 0 ? Math.round(nutrition.reduce((s, d) => s + d.kcal, 0) / nutrition.length) : 0);
  const logPct = data.total_days > 0 ? Math.round((data.days_logged / data.total_days) * 100) : 0;

  return (
    <DashboardLayout title="Analytics">
      {/* ─── Date Range Picker ─── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1.5">
          {PRESETS.map(p => (
            <button
              key={p.days}
              onClick={() => { setActivePreset(p.days); setDays(p.days); setCustomFrom(""); setCustomTo(""); }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                activePreset === p.days
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-border mx-1 hidden sm:block" />
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            className="bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
            className="bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={applyCustomRange}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
          >
            Apply
          </button>
        </div>
      </div>

      {/* ─── Row 1: Hero Metrics ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="pill pill-green rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Days Logged</p>
          <p className="text-2xl font-bold tabular-nums text-foreground">{data.days_logged}<span className="text-sm font-normal text-muted-foreground">/{data.total_days}</span></p>
          <p className="text-xs text-emerald-400 font-medium mt-0.5">{logPct}% consistency</p>
        </div>
        <div className="pill pill-blue rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Current Streak</p>
          <p className="text-2xl font-bold tabular-nums text-foreground">{data.current_streak}</p>
          <p className="text-xs text-blue-400 font-medium mt-0.5">consecutive days</p>
        </div>
        <div className="pill pill-amber rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Avg Daily Kcal</p>
          <p className="text-2xl font-bold tabular-nums text-foreground">{avgKcal.toLocaleString()}</p>
          <p className="text-xs text-amber-400 font-medium mt-0.5">target {targetKcal.toLocaleString()}</p>
        </div>
        <div className="pill pill-purple rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Supplements</p>
          <p className="text-2xl font-bold tabular-nums text-foreground">{Math.round(data.supplement_adherence_pct)}%</p>
          <p className="text-xs text-purple-400 font-medium mt-0.5">adherence rate</p>
        </div>
      </div>

      {/* ─── All sections in one continuous grid ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        {/* Weight & Body Composition */}
        <SectionCard title="Weight History" span="lg:col-span-2">
          {weightData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No weight data recorded yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={weightData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray={GRID_DASH} stroke={GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={TICK_X}
                  axisLine={false}
                  tickLine={false}
                  interval={computeAxisInterval(weightData.length)}
                  tickFormatter={(v: string) => fmtDateAxis(v, weightData.length)}
                />
                <YAxis tick={TICK_Y} axisLine={false} tickLine={false} width={40} domain={["auto", "auto"]} />
                <Tooltip content={<ChartTooltip valueSuffix=" kg" />} />
                {targetWeight != null && (
                  <ReferenceLine y={targetWeight} stroke={COLORS.blue} strokeDasharray="6 3" strokeWidth={1.5} label={{ value: `Target ${targetWeight} kg`, fill: "#666", fontSize: 10, position: "right" }} />
                )}
                <Area
                  type="monotone"
                  dataKey="weight_kg"
                  stroke={COLORS.green}
                  strokeWidth={2.5}
                  fill="url(#weightGrad)"
                  dot={{ fill: COLORS.green, r: 2, strokeWidth: 0 }}
                  activeDot={{ r: 5, stroke: COLORS.green, strokeWidth: 2, fill: "#1e1e22" }}
                  animationDuration={800}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="Body Composition">
          {bodyCompData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No body composition data</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={bodyCompData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray={GRID_DASH} stroke={GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={TICK_X}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={nthTickFormatter(bodyCompData, 6)}
                />
                <YAxis tick={TICK_Y} axisLine={false} tickLine={false} width={35} domain={["auto", "auto"]} />
                <Tooltip content={<MultiLineTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={28}
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => <span style={{ color: "#aaa", fontSize: 11 }}>{value}</span>}
                />
                <Line
                  type="monotone"
                  dataKey="body_fat_pct"
                  name="Body Fat %"
                  stroke={COLORS.amber}
                  strokeWidth={2}
                  dot={{ fill: COLORS.amber, r: 2, strokeWidth: 0 }}
                  activeDot={{ r: 4, stroke: COLORS.amber, strokeWidth: 2, fill: "#1e1e22" }}
                  connectNulls
                  animationDuration={800}
                />
                <Line
                  type="monotone"
                  dataKey="muscle_mass_pct"
                  name="Muscle %"
                  stroke={COLORS.blue}
                  strokeWidth={2}
                  dot={{ fill: COLORS.blue, r: 2, strokeWidth: 0 }}
                  activeDot={{ r: 4, stroke: COLORS.blue, strokeWidth: 2, fill: "#1e1e22" }}
                  connectNulls
                  animationDuration={800}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* Calorie Trend & Macro Distribution */}
        <SectionCard title="Calorie Trend" span="lg:col-span-2">
          {nutrition.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No calorie data</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={rollingNutrition} margin={{ top: 5, right: 10, bottom: 30, left: 0 }}>
                <defs>
                  <linearGradient id="calAvgGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.green} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray={GRID_DASH} stroke={GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={TICK_X}
                  axisLine={false}
                  tickLine={false}
                  interval={computeAxisInterval(rollingNutrition.length)}
                  tickFormatter={(v: string) => fmtDateAxis(v, rollingNutrition.length)}
                />
                <YAxis tick={TICK_Y} axisLine={false} tickLine={false} width={45} />
                <Tooltip content={<ChartTooltip valueSuffix=" kcal" />} />
                <ReferenceLine
                  y={targetKcal}
                  stroke={COLORS.amber}
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                  label={{ value: `Target ${targetKcal}`, fill: "#888", fontSize: 10, position: "right" }}
                />
                <Area
                  type="monotone"
                  dataKey="avg_kcal"
                  name="7-day avg"
                  stroke={COLORS.green}
                  strokeWidth={2.5}
                  fill="url(#calAvgGrad)"
                  dot={false}
                  activeDot={{ r: 5, stroke: COLORS.green, strokeWidth: 2, fill: "#1e1e22" }}
                  animationDuration={800}
                />
                <Line
                  type="monotone"
                  dataKey="kcal"
                  name="Daily kcal"
                  stroke="transparent"
                  strokeWidth={0}
                  dot={{ fill: COLORS.green, r: 2, fillOpacity: 0.3, strokeWidth: 0 }}
                  activeDot={{ r: 4, stroke: COLORS.green, strokeWidth: 1, fill: "#1e1e22" }}
                  animationDuration={600}
                  legendType="none"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="Macro Distribution">
          {macroPie.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No macro data</p>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="w-[180px] h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={macroPie}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={78}
                      dataKey="value"
                      stroke="none"
                      animationDuration={800}
                    >
                      {macroPie.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={TT_STYLE}
                      formatter={(value: unknown, name: unknown) => [`${typeof value === "number" ? fmt(value) : value}%`, String(name)]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2.5 w-full">
                {macroPie.map(m => (
                  <div key={m.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.fill }} />
                      <span className="text-sm text-muted-foreground">{m.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold tabular-nums text-foreground">{m.value}%</span>
                      <span className="text-xs text-muted-foreground/60 tabular-nums">{m.grams}g</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        {/* Detailed Macro Trends */}
        <SectionCard title="Macro Trends" span="lg:col-span-3">
          {nutrition.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No macro data</p>
          ) : (
            <>
              <div className="flex gap-1.5 mb-4">
                {(["all", "protein", "carbs", "fat"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setMacroTab(tab)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                      macroTab === tab
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={rollingNutrition} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="proteinGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="carbsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fatGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.amber} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={COLORS.amber} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray={GRID_DASH} stroke={GRID_STROKE} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={TICK_X}
                    axisLine={false}
                    tickLine={false}
                    interval={computeAxisInterval(rollingNutrition.length)}
                    tickFormatter={(v: string) => fmtDateAxis(v, rollingNutrition.length)}
                  />
                  <YAxis tick={TICK_Y} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<MultiLineTooltip />} />
                  {(macroTab === "all" || macroTab === "protein") && (
                    <>
                      <Line type="monotone" dataKey="protein" name="Protein (raw)" stroke="transparent" strokeWidth={0} dot={{ fill: COLORS.blue, r: 1.5, fillOpacity: 0.25, strokeWidth: 0 }} activeDot={false} animationDuration={600} legendType="none" />
                      <Area type="monotone" dataKey="avg_protein" name="Protein (g)" stroke={COLORS.blue} strokeWidth={2} fill="url(#proteinGrad)" dot={false} animationDuration={600} />
                      {macroTab === "protein" && (
                        <ReferenceLine y={targetProtein} stroke={COLORS.blue} strokeDasharray="6 3" strokeWidth={1} />
                      )}
                    </>
                  )}
                  {(macroTab === "all" || macroTab === "carbs") && (
                    <>
                      <Line type="monotone" dataKey="carbs" name="Carbs (raw)" stroke="transparent" strokeWidth={0} dot={{ fill: COLORS.green, r: 1.5, fillOpacity: 0.25, strokeWidth: 0 }} activeDot={false} animationDuration={600} legendType="none" />
                      <Area type="monotone" dataKey="avg_carbs" name="Carbs (g)" stroke={COLORS.green} strokeWidth={2} fill="url(#carbsGrad)" dot={false} animationDuration={600} />
                      {macroTab === "carbs" && (
                        <ReferenceLine y={targetCarbs} stroke={COLORS.green} strokeDasharray="6 3" strokeWidth={1} />
                      )}
                    </>
                  )}
                  {(macroTab === "all" || macroTab === "fat") && (
                    <>
                      <Line type="monotone" dataKey="fat" name="Fat (raw)" stroke="transparent" strokeWidth={0} dot={{ fill: COLORS.amber, r: 1.5, fillOpacity: 0.25, strokeWidth: 0 }} activeDot={false} animationDuration={600} legendType="none" />
                      <Area type="monotone" dataKey="avg_fat" name="Fat (g)" stroke={COLORS.amber} strokeWidth={2} fill="url(#fatGrad)" dot={false} animationDuration={600} />
                      {macroTab === "fat" && (
                        <ReferenceLine y={targetFat} stroke={COLORS.amber} strokeDasharray="6 3" strokeWidth={1} />
                      )}
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </>
          )}
        </SectionCard>

        {/* Fiber, Sugar, Sodium */}
        {[
          { key: "fiber" as const, label: "Fiber", unit: "g", color: COLORS.green, target: targetFiber },
          { key: "sugar" as const, label: "Sugar", unit: "g", color: COLORS.pink, target: targetSugar },
          { key: "sodium" as const, label: "Sodium", unit: "mg", color: COLORS.orange, target: targetSodium },
        ].map(metric => (
          <SectionCard key={metric.key} title={`${metric.label} Trend`}>
            {nutrition.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <ComposedChart data={rollingNutrition} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id={`${metric.key}Grad`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={metric.color} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={metric.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray={GRID_DASH} stroke={GRID_STROKE} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#888", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={nthTickFormatter(rollingNutrition, 4)}
                  />
                  <YAxis tick={{ fill: "#aaa", fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
                  <Tooltip content={<ChartTooltip valueSuffix={` ${metric.unit}`} />} />
                  <ReferenceLine y={metric.target} stroke={metric.color} strokeDasharray="4 3" strokeWidth={1} strokeOpacity={0.6} />
                  <Line
                    type="monotone"
                    dataKey={metric.key}
                    stroke="transparent"
                    strokeWidth={0}
                    dot={{ fill: metric.color, r: 1.5, fillOpacity: 0.25, strokeWidth: 0 }}
                    activeDot={false}
                    animationDuration={600}
                    legendType="none"
                  />
                  <Area
                    type="monotone"
                    dataKey={`avg_${metric.key}`}
                    name={`${metric.label} (7d avg)`}
                    stroke={metric.color}
                    strokeWidth={1.5}
                    fill={`url(#${metric.key}Grad)`}
                    dot={false}
                    animationDuration={600}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </SectionCard>
        ))}

        {/* Alcohol Trend */}
        <SectionCard title="Alcohol Trend">
          {nutrition.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <ComposedChart data={rollingNutrition} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="alcoholGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.orange} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={COLORS.orange} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray={GRID_DASH} stroke={GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#888", fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={nthTickFormatter(rollingNutrition, 4)}
                />
                <YAxis tick={{ fill: "#aaa", fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
                <Tooltip content={<ChartTooltip valueSuffix=" g" />} />
                {targetAlcohol > 0 && (
                  <ReferenceLine y={targetAlcohol} stroke={COLORS.orange} strokeDasharray="4 3" strokeWidth={1} strokeOpacity={0.6} />
                )}
                <Line
                  type="monotone"
                  dataKey="alcohol"
                  stroke="transparent"
                  strokeWidth={0}
                  dot={{ fill: COLORS.orange, r: 1.5, fillOpacity: 0.25, strokeWidth: 0 }}
                  activeDot={false}
                  animationDuration={600}
                  legendType="none"
                />
                <Area
                  type="monotone"
                  dataKey="avg_alcohol"
                  name="Alcohol (7d avg)"
                  stroke={COLORS.orange}
                  strokeWidth={1.5}
                  fill="url(#alcoholGrad)"
                  dot={false}
                  animationDuration={600}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* Water Trend */}
        <SectionCard title="Water Trend">
          {(!data.daily_water || data.daily_water.length === 0) ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No water data</p>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={data.daily_water} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.cyan} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={COLORS.cyan} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray={GRID_DASH} stroke={GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#888", fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={nthTickFormatter(data.daily_water as { date: string }[], 4)}
                />
                <YAxis tick={{ fill: "#aaa", fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
                <Tooltip content={<ChartTooltip valueSuffix=" ml" />} />
                <ReferenceLine y={targetWaterMl} stroke={COLORS.cyan} strokeDasharray="4 3" strokeWidth={1} strokeOpacity={0.6} />
                <Area
                  type="monotone"
                  dataKey="total_ml"
                  name="Water (ml)"
                  stroke={COLORS.cyan}
                  strokeWidth={2}
                  fill="url(#waterGrad)"
                  dot={{ fill: COLORS.cyan, r: 2, strokeWidth: 0 }}
                  activeDot={{ r: 4, stroke: COLORS.cyan, strokeWidth: 2, fill: "#1e1e22" }}
                  animationDuration={600}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* Caffeine Trend */}
        <SectionCard title="Caffeine Trend">
          {(!data.daily_caffeine || data.daily_caffeine.length === 0) ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No caffeine data</p>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={data.daily_caffeine} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="caffGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#92400e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#92400e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray={GRID_DASH} stroke={GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#888", fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={nthTickFormatter(data.daily_caffeine as { date: string }[], 4)}
                />
                <YAxis tick={{ fill: "#aaa", fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
                <Tooltip content={<ChartTooltip valueSuffix=" mg" />} />
                <ReferenceLine y={targetCaffeineMg} stroke="#b45309" strokeDasharray="4 3" strokeWidth={1} strokeOpacity={0.6} />
                <Area
                  type="monotone"
                  dataKey="total_mg"
                  name="Caffeine (mg)"
                  stroke="#92400e"
                  strokeWidth={2}
                  fill="url(#caffGrad)"
                  dot={{ fill: "#92400e", r: 2, strokeWidth: 0 }}
                  activeDot={{ r: 4, stroke: "#92400e", strokeWidth: 2, fill: "#1e1e22" }}
                  animationDuration={600}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* Micronutrient Averages */}
        <SectionCard title="Micronutrient Averages" span="lg:col-span-3">
          {(!data.micro_avg) ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No micronutrient data</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { key: "vit_d" as const, label: "Vitamin D", target: 100, unit: "\u00b5g" },
                { key: "zinc" as const, label: "Zinc", target: 15, unit: "mg" },
                { key: "omega3" as const, label: "Omega-3", target: 1000, unit: "mg" },
                { key: "magnesium" as const, label: "Magnesium", target: 400, unit: "mg" },
                { key: "b12" as const, label: "B12", target: 2.4, unit: "\u00b5g" },
                { key: "iron" as const, label: "Iron", target: 18, unit: "mg" },
                { key: "calcium" as const, label: "Calcium", target: 1000, unit: "mg" },
                { key: "vit_c" as const, label: "Vitamin C", target: 90, unit: "mg" },
                { key: "potassium" as const, label: "Potassium", target: 3500, unit: "mg" },
              ].map(micro => {
                const avg = data.micro_avg[micro.key] ?? 0;
                const pct = micro.target > 0 ? Math.round((avg / micro.target) * 100) : 0;
                const barColor = pct >= 80 ? "from-green-500 to-green-400" : pct >= 40 ? "from-amber-500 to-amber-400" : "from-red-500 to-red-400";
                const badgeColor = pct >= 80 ? "bg-green-500/15 text-green-400" : pct >= 40 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400";
                return (
                  <div key={micro.key} className="pill rounded-lg p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">{micro.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold tabular-nums text-foreground">
                          {typeof avg === "number" ? fmt(avg) : avg} {micro.unit}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">/ {micro.target} {micro.unit}</span>
                        <span className={`text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full ${badgeColor}`}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted/30 overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-500`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Supplement Consistency */}
        <SectionCard title="Supplement Consistency" span="lg:col-span-2">
          {data.supplement_log.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No supplement data</p>
          ) : (() => {
            const suppLog = data.supplement_log;
            const daysWithSupps = suppLog.filter(s => s.count > 0).length;
            const adherencePct = days > 0 ? Math.round((daysWithSupps / days) * 100) : 0;

            // Per-supplement frequency
            const suppFreq: Record<string, number> = {};
            for (const entry of suppLog) {
              for (const name of entry.names) {
                suppFreq[name] = (suppFreq[name] || 0) + 1;
              }
            }
            const suppList = Object.entries(suppFreq)
              .sort((a, b) => b[1] - a[1])
              .map(([name, count]) => ({ name, count, pct: days > 0 ? Math.round((count / days) * 100) : 0 }));

            return (
              <div className="flex flex-col lg:flex-row gap-5">
                {/* Left: trend chart */}
                <div className="flex-1 min-w-0">
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={suppLog} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                      <defs>
                        <linearGradient id="suppGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray={GRID_DASH} stroke={GRID_STROKE} vertical={false} />
                      <XAxis dataKey="date" tick={TICK_X} axisLine={false} tickLine={false}
                        tickFormatter={nthTickFormatter(suppLog, 5)} />
                      <YAxis tick={TICK_Y} axisLine={false} tickLine={false} width={25} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip valueSuffix=" supplements" />} />
                      <Area type="monotone" dataKey="count" stroke={COLORS.green} strokeWidth={2}
                        fill="url(#suppGrad)" dot={false} animationDuration={600} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {/* Right: per-supplement breakdown */}
                <div className="lg:w-56 shrink-0 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Overall</span>
                    <span className="text-xs font-bold text-primary tabular-nums">{adherencePct}%</span>
                  </div>
                  {suppList.map(s => (
                    <div key={s.name}>
                      <div className="flex items-center justify-between text-[11px] mb-0.5">
                        <span className="text-foreground/80 truncate mr-2">{s.name}</span>
                        <span className="text-muted-foreground tabular-nums shrink-0">{s.pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${s.pct}%`, background: s.pct >= 80 ? "linear-gradient(90deg, #22c55e, #4ade80)" : s.pct >= 50 ? "linear-gradient(90deg, #f59e0b, #fbbf24)" : "linear-gradient(90deg, #ef4444, #f87171)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </SectionCard>

        <SectionCard title="Personal Records">
          <div className="space-y-3">
            {[
              {
                label: "Highest Protein Day",
                data: data.highest_protein_day,
                value: data.highest_protein_day ? `${data.highest_protein_day.protein}g` : null,
                date: data.highest_protein_day?.date,
                pill: "pill-blue",
                color: COLORS.blue,
              },
              {
                label: "Lowest Calorie Day",
                data: data.lowest_calorie_day,
                value: data.lowest_calorie_day ? `${data.lowest_calorie_day.kcal.toLocaleString()} kcal` : null,
                date: data.lowest_calorie_day?.date,
                pill: "pill-green",
                color: COLORS.green,
              },
              {
                label: "Highest Calorie Day",
                data: data.highest_calorie_day,
                value: data.highest_calorie_day ? `${data.highest_calorie_day.kcal.toLocaleString()} kcal` : null,
                date: data.highest_calorie_day?.date,
                pill: "pill-amber",
                color: COLORS.amber,
              },
              {
                label: "Best Fiber Day",
                data: data.best_fiber_day,
                value: data.best_fiber_day ? `${data.best_fiber_day.fiber}g` : null,
                date: data.best_fiber_day?.date,
                pill: "pill-green",
                color: COLORS.teal,
              },
              {
                label: "Longest Streak",
                data: true,
                value: `${data.current_streak} days`,
                date: null,
                pill: "pill-purple",
                color: COLORS.purple,
              },
            ].map(record => (
              <div key={record.label} className={`pill ${record.pill} rounded-lg p-3`}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{record.label}</p>
                {record.data && record.value ? (
                  <div className="flex items-baseline justify-between">
                    <span className="text-base font-bold tabular-nums" style={{ color: record.color }}>
                      {record.value}
                    </span>
                    {record.date && (
                      <span className="text-[10px] text-muted-foreground/60">{fmtDate(record.date)}</span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground/50">--</p>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </DashboardLayout>
  );
}
