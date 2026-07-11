"use client";

import { useState } from "react";
import { useWeekSummary, useSettings } from "@/hooks/queries";
import { getErrorMessage } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ErrorState } from "@/components/ui/error-state";
import { CalorieChartCard } from "@/components/calorie-chart";
import { WeightTrendCard } from "@/components/weight-trend";
import { MacroAveragesCard } from "@/components/macro-averages";
import { MicronutrientSummaryCard } from "@/components/micronutrient-summary";
import { BodyCompCard } from "@/components/body-comp";
import { HydrationWeeklyCard } from "@/components/hydration-weekly";

export default function WeeklyPage() {
  const [mode, setMode] = useState<"last7" | "week">("week");
  const [offset, setOffset] = useState(0);
  const { data, isLoading, isError, error, refetch } = useWeekSummary(mode, offset);
  const { data: settings } = useSettings();

  function goBack() { setOffset((o) => Math.min(o + 1, 52)); }
  function goForward() { setOffset((o) => Math.max(o - 1, 0)); }

  function weekLabel() {
    if (!data) return "";
    const from = new Date(data.start_date + "T00:00:00");
    const to = new Date(data.end_date + "T00:00:00");
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (offset === 0) return `${fmt(from)} — ${fmt(to)} (current)`;
    return `${fmt(from)} — ${fmt(to)}`;
  }

  const targetKcal = settings?.nutrition_targets.target_kcal ?? 2000;

  return (
    <DashboardLayout title="Weekly Overview">
      {isError ? (
        <ErrorState message={getErrorMessage(error, "Couldn't load the weekly summary.")} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <div className="space-y-4">
          {/* Skeleton hero row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="pill rounded-xl p-4 animate-pulse">
                <div className="h-2 w-16 rounded bg-muted mb-2" />
                <div className="h-6 w-20 rounded bg-muted" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="clay-card p-5 space-y-4 animate-pulse">
                <div className="h-3 w-28 rounded bg-muted" />
                <div className="h-40 rounded-xl bg-muted" />
                <div className="space-y-2">
                  <div className="h-2 w-full rounded bg-muted" />
                  <div className="h-2 w-2/3 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── Mode toggle + week navigation ── */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 -mt-1">
            <div className="flex items-center gap-1.5">
              {([
                { value: "last7" as const, label: "Last 7 days" },
                { value: "week" as const, label: "Mon–Sun" },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setMode(opt.value); setOffset(0); }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
                    mode === opt.value
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={goBack}
                disabled={offset >= 52}
                className="p-1.5 rounded-lg bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-xs text-muted-foreground min-w-[160px] text-center tabular-nums">
                {weekLabel()}
              </span>
              <button
                onClick={goForward}
                disabled={offset <= 0}
                className="p-1.5 rounded-lg bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── Hero metrics row ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="pill pill-green rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Total Kcal</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {Math.round(data.daily_avg.kcal * 7).toLocaleString()}
              </p>
              <p className="text-xs text-emerald-400 font-medium mt-0.5">this week</p>
            </div>
            <div className="pill pill-blue rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Avg Daily Kcal</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {Math.round(data.daily_avg.kcal).toLocaleString()}
              </p>
              <p className="text-xs text-blue-400 font-medium mt-0.5">
                {data.daily_avg.kcal > targetKcal ? "+" : ""}{Math.round(data.daily_avg.kcal - targetKcal)} vs target
              </p>
            </div>
            <div className="pill pill-amber rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Weight Change</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {data.weight.delta != null
                  ? `${data.weight.delta > 0 ? "+" : ""}${fmt(data.weight.delta)} kg`
                  : "--"}
              </p>
              <p className="text-xs text-amber-400 font-medium mt-0.5">
                {data.weight.end_kg ? `${fmt(data.weight.end_kg)} kg current` : "no data"}
              </p>
            </div>
            <div className="pill pill-purple rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Days Logged</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {(() => {
                  const todayIdx = (new Date().getDay() + 6) % 7;
                  return todayIdx + 1;
                })()}
                <span className="text-sm font-normal text-muted-foreground">/7</span>
              </p>
              <p className="text-xs text-purple-400 font-medium mt-0.5">this week</p>
            </div>
          </div>

          {/* ── Bento grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Calorie chart: 2 cols */}
            <CalorieChartCard
              dailyAvgKcal={data.daily_avg.kcal}
              targetKcal={targetKcal}
              dailyData={data.daily_calories}
            />

            {/* Weight trend: 1 col */}
            <WeightTrendCard weight={data.weight} bodyComp={data.body_comp} goalKg={settings?.nutrition_targets.target_weight_kg} />

            {/* Body composition: 1 col */}
            {data.body_comp.length > 0 && (
              <BodyCompCard data={data.body_comp} />
            )}

            {/* Macro averages: 1 col (or 2 if no body comp) */}
            <MacroAveragesCard
              dailyAvg={data.daily_avg}
              targets={settings?.nutrition_targets}
            />

            {/* Hydration & Caffeine weekly */}
            <HydrationWeeklyCard
              dailyWater={data.daily_water ?? []}
              dailyCaffeine={data.daily_caffeine ?? []}
              targetWater={settings?.nutrition_targets?.target_water_ml ?? 2500}
              targetCaffeine={settings?.nutrition_targets?.target_caffeine_mg ?? 400}
            />

            {/* Micronutrients: 2 cols */}
            <MicronutrientSummaryCard
              microAvg={data.micronutrient_avg}
              microTargets={settings?.micronutrient_targets}
              dateRange={{ from: data.start_date, to: data.end_date }}
            />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
