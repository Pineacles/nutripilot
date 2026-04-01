"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTodaySummary } from "@/hooks/use-summary";
import { useSettings } from "@/hooks/use-settings";
import { DashboardLayout } from "@/components/dashboard-layout";
import { CalorieRingCard } from "@/components/macro-ring";
import { MacroBreakdownCard } from "@/components/macro-breakdown";
import { QuickStatsCard } from "@/components/quick-stats";
import { MealsLogCard } from "@/components/meals-list";
import { SupplementsCard } from "@/components/supplement-checklist";

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(dateStr: string, n: number): string {
  const parts = dateStr.split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function parseLocal(dateStr: string): Date {
  const parts = dateStr.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDisplay(dateStr: string): string {
  const today = toDateStr(new Date());
  const yesterday = addDays(today, -1);
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return parseLocal(dateStr).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default function TodayPage() {
  return (
    <Suspense>
      <TodayPageInner />
    </Suspense>
  );
}

function TodayPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const todayStr = toDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(searchParams.get("date") || todayStr);

  const { data, loading } = useTodaySummary(selectedDate);
  const { data: settings } = useSettings();

  const hasMeals = data && data.meals.length > 0;
  const hasSupplements = data && data.supplements.length > 0;
  const isToday = selectedDate === todayStr;
  const isFuture = selectedDate > todayStr;

  function goToDate(dateStr: string) {
    setSelectedDate(dateStr);
    router.replace(`/today?date=${dateStr}`, { scroll: false });
  }

  return (
    <DashboardLayout title="Daily Overview">
      {/* Date navigation */}
      <div className="flex items-center justify-between -mt-4 mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => goToDate(addDays(selectedDate, -1))}
            className="p-1.5 rounded-lg bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-150"
            aria-label="Previous day"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <p className="text-lg font-medium text-foreground">{formatDisplay(selectedDate)}</p>
            {!isToday && (
              <p className="text-xs text-muted-foreground">
                {parseLocal(selectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            )}
          </div>
          <button
            onClick={() => goToDate(addDays(selectedDate, 1))}
            disabled={isFuture}
            className={`p-1.5 rounded-lg transition-colors duration-150 ${
              isFuture
                ? "text-muted-foreground/30 cursor-not-allowed"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            aria-label="Next day"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            max={todayStr}
            onChange={(e) => e.target.value && goToDate(e.target.value)}
            className="bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {!isToday && (
            <button
              onClick={() => goToDate(todayStr)}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {loading || !data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="clay-card p-5 space-y-4 animate-pulse">
              <div className="h-3 w-24 rounded bg-muted" />
              <div className="h-32 rounded-xl bg-muted" />
              <div className="space-y-2">
                <div className="h-2 w-full rounded bg-muted" />
                <div className="h-2 w-3/4 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min">
          <CalorieRingCard totals={data.totals} targets={data.targets} water={data.water} caffeine={data.caffeine} />
          <MacroBreakdownCard totals={data.totals} targets={data.targets} dateRange={{ from: data.date, to: data.date }} />
          <QuickStatsCard data={data} />

          {hasMeals && <MealsLogCard meals={data.meals} />}

          {hasSupplements && (
            <SupplementsCard
              supplements={data.supplements}
              definitions={settings?.supplement_definitions}
              microTargets={settings?.micronutrient_targets}
            />
          )}

          {/* Empty state */}
          {!hasMeals && !hasSupplements && (
            <div className="clay-card p-8 text-center lg:col-span-3">
              <p className="text-muted-foreground text-sm">Nothing logged yet today. Your agent will populate this.</p>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
