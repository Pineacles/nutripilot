"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTodaySummary, useSettings } from "@/hooks/queries";
import { getErrorMessage } from "@/lib/api";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { CalorieRingCard } from "@/components/macro-ring";
import { MacroBreakdownCard } from "@/components/macro-breakdown";
import { QuickStatsCard } from "@/components/quick-stats";
import { MealsLogCard } from "@/components/meals-list";
import { SupplementsCard } from "@/components/supplement-checklist";
import { HydrationCard } from "@/components/hydration-card";
import { AddFoodDialog } from "@/components/food-log/add-food-dialog";
import { todayStr, addDays, parseLocal } from "@/lib/dates";

function formatDisplay(dateStr: string): string {
  const today = todayStr();
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
  const todayDateStr = todayStr();
  const [selectedDate, setSelectedDate] = useState(searchParams.get("date") || todayDateStr);

  const { data, isLoading, isError, error, refetch } = useTodaySummary(selectedDate);
  const { data: settings } = useSettings();
  const [addFoodOpen, setAddFoodOpen] = useState(false);

  const isToday = selectedDate === todayDateStr;
  const isFuture = selectedDate > todayDateStr;

  function goToDate(dateStr: string) {
    setSelectedDate(dateStr);
    router.replace(`/today?date=${dateStr}`, { scroll: false });
  }

  return (
    <DashboardLayout title="Daily Overview">
      {/* Date navigation */}
      <div className="flex items-center justify-between -mt-4 mb-4 flex-wrap gap-3">
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
            max={todayDateStr}
            onChange={(e) => e.target.value && goToDate(e.target.value)}
            className="bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {!isToday && (
            <button
              onClick={() => goToDate(todayDateStr)}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
            >
              Today
            </button>
          )}
          <Button onClick={() => setAddFoodOpen(true)} size="lg">
            + Log food
          </Button>
        </div>
      </div>

      <AddFoodDialog open={addFoodOpen} onOpenChange={setAddFoodOpen} defaultDate={selectedDate} />

      {isError ? (
        <ErrorState message={getErrorMessage(error, "Couldn't load today's summary.")} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
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

          <MealsLogCard date={selectedDate} />

          <SupplementsCard
            date={selectedDate}
            definitions={settings?.supplement_definitions}
            microTargets={settings?.micronutrient_targets}
          />

          <HydrationCard water={data.water} caffeine={data.caffeine} date={selectedDate} />
        </div>
      )}
    </DashboardLayout>
  );
}
