"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTodaySummary, useSettings } from "@/hooks/queries";
import { useTracked } from "@/hooks/use-tracked";
import { getErrorMessage } from "@/lib/api";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { DayPoster } from "@/components/today/day-poster";
import { MEAL_TYPE_LABELS, mealForTime } from "@/lib/meal-types";
import { MealsLogCard } from "@/components/meals-list";
import { SupplementsCard } from "@/components/supplement-checklist";
import { HydrationCard } from "@/components/hydration-card";
import { InstallCard } from "@/components/install-card";
import { AddFoodDialog } from "@/components/food-log/add-food-dialog";
import { todayStr, addDays, parseLocal } from "@/lib/dates";
import type { MealType } from "@/lib/types";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

function formatDisplay(dateStr: string): string {
  const today = todayStr();
  if (dateStr === today) return "Today";
  if (dateStr === addDays(today, -1)) return "Yesterday";
  return parseLocal(dateStr).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** The date under the label, Swiss order: "25 Oct 2026". */
function formatFull(dateStr: string): string {
  return parseLocal(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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
  const { shows } = useTracked();
  const [addFoodOpen, setAddFoodOpen] = useState(false);
  const [addToMeal, setAddToMeal] = useState<MealType | undefined>(undefined);

  function openLogFood(meal?: MealType) {
    setAddToMeal(meal);
    setAddFoodOpen(true);
  }

  const isToday = selectedDate === todayDateStr;
  const isFuture = selectedDate > todayDateStr;

  function goToDate(dateStr: string) {
    setSelectedDate(dateStr);
    router.replace(`/today?date=${dateStr}`, { scroll: false });
  }

  return (
    <DashboardLayout title="Daily Overview" hideTitle>
      {/* Top row: the day (tap to pick another) and previous/next, ruled off like a poster's head */}
      <div className="-mt-2 flex items-center gap-2 border-b border-g2 pb-2">
        <label className="relative -ml-1 flex min-w-0 cursor-pointer items-baseline gap-2 rounded-lg px-1 py-1.5 focus-within:outline-2 focus-within:outline-ink">
          <span className="text-[22px] font-semibold tracking-[-0.01em] text-ink">{formatDisplay(selectedDate)}</span>
          {(isToday || selectedDate === addDays(todayDateStr, -1)) && (
            <span className="truncate text-[15px] text-g4">{formatFull(selectedDate)}</span>
          )}
          <input
            type="date"
            value={selectedDate}
            max={todayDateStr}
            onChange={(e) => e.target.value && goToDate(e.target.value)}
            onClick={(e) => { try { e.currentTarget.showPicker(); } catch { /* opens natively */ } }}
            aria-label="Pick a day"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <div className="ml-auto flex items-center">
          {!isToday && (
            <button
              onClick={() => goToDate(todayDateStr)}
              className="h-11 rounded-full px-3 text-[13px] font-medium text-ink transition-colors hover:bg-g2"
            >
              Today
            </button>
          )}
          <button
            onClick={() => goToDate(addDays(selectedDate, -1))}
            className="flex h-11 w-11 items-center justify-center rounded-full text-g5 transition-colors hover:bg-g2 hover:text-ink"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => goToDate(addDays(selectedDate, 1))}
            disabled={isFuture}
            className="flex h-11 w-11 items-center justify-center rounded-full text-g5 transition-colors hover:bg-g2 hover:text-ink disabled:text-g3 disabled:hover:bg-transparent"
            aria-label="Next day"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <Button onClick={() => openLogFood()} size="lg" className="ml-3 hidden h-11 rounded-full px-5 md:inline-flex">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Log food
          </Button>
        </div>
      </div>

      <AddFoodDialog open={addFoodOpen} onOpenChange={setAddFoodOpen} defaultDate={selectedDate} initialMeal={addToMeal} />

      {isError ? (
        <ErrorState message={getErrorMessage(error, "Couldn't load today's summary.")} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <div className="space-y-px pt-4" aria-busy="true" aria-label="Loading the day">
          <div className="h-[232px] animate-pulse bg-g1/60" />
          <div className="h-20 animate-pulse bg-g1/40" />
          <div className="h-48 animate-pulse bg-g1/30" />
        </div>
      ) : (
        <div className="grid auto-rows-min grid-cols-1 gap-x-4 md:grid-cols-2 md:gap-y-4 lg:grid-cols-3">
          <DayPoster date={selectedDate} totals={data.totals} targets={data.targets} water={data.water} caffeine={data.caffeine} />
          <MealsLogCard date={selectedDate} onAddToMeal={openLogFood} />
          {/* One right-hand column on wide screens, so the water log never sits alone in a row */}
          <div className="flex flex-col md:gap-4">
            <SupplementsCard
              date={selectedDate}
              definitions={settings?.supplement_definitions}
              microTargets={settings?.micronutrient_targets}
            />
            {/* The poster carries macros, details and drinks (tap a value for its foods). Wider screens
                keep the water log for editing single entries. */}
            {(shows("water") || shows("caffeine")) && (
              <div className="max-md:hidden">
                <HydrationCard water={data.water} caffeine={data.caffeine} date={selectedDate} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Log food: a full width ink bar in thumb reach on a ground band, naming where it logs to */}
      <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 border-t border-g2 bg-g0 px-4 py-2.5 md:hidden">
        <button
          type="button"
          onClick={() => openLogFood()}
          className="flex h-13 w-full items-center justify-between rounded-full bg-ink px-6 text-[17px] font-medium text-g0 transition-transform active:scale-[0.98] motion-reduce:transition-none"
        >
          <span className="flex items-center gap-2">
            <Plus className="h-5 w-5" aria-hidden="true" />
            Log food
          </span>
          <span className="text-[13px] font-normal text-g3">
            {isToday ? `to ${MEAL_TYPE_LABELS[mealForTime()].toLowerCase()}` : `to ${formatDisplay(selectedDate)}`}
          </span>
        </button>
      </div>

      <InstallCard dismissible className="mt-4 lg:hidden" />
      {/* Room so the Log food bar never covers the last section */}
      <div className="h-24 md:hidden" aria-hidden="true" />
    </DashboardLayout>
  );
}
