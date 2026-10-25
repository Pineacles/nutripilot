"use client";

import { useState } from "react";
import { useCountUp } from "@/hooks/use-count-up";
import { useWeekSummary, useSettings } from "@/hooks/queries";
import { getErrorMessage } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { gapPhrase } from "@/lib/chart-utils";
import { DashboardLayout } from "@/components/dashboard-layout";
import { SectionGroup } from "@/components/charts/section-card";
import { plateOf } from "@/lib/plates";
import { useTracked } from "@/hooks/use-tracked";
import { ErrorState } from "@/components/ui/error-state";
import { CalorieChartCard } from "@/components/calorie-chart";
import { WeightTrendCard } from "@/components/weight-trend";
import { MacroAveragesCard } from "@/components/macro-averages";
import { MicronutrientSummaryCard } from "@/components/micronutrient-summary";
import { BodyCompCard } from "@/components/body-comp";
import { HydrationWeeklyCard } from "@/components/hydration-weekly";

const CHIP = "h-11 rounded-full border px-4 text-[13px] font-medium transition-colors duration-150";
const ICON_BTN = "flex h-11 w-11 items-center justify-center rounded-full text-g4 transition-colors hover:bg-g2 hover:text-ink disabled:text-g3 disabled:hover:bg-transparent";

const MICRO_KEYS = ["vit_d", "zinc", "omega3", "magnesium", "b12", "iron", "calcium", "vit_c", "potassium"];

export default function WeeklyPage() {
  const [mode, setMode] = useState<"last7" | "week">("week");
  const [offset, setOffset] = useState(0);
  const { data, isLoading, isError, error, refetch } = useWeekSummary(mode, offset);
  const { data: settings } = useSettings();
  const { shows } = useTracked();
  const avgKcal = Math.round(data?.daily_avg.kcal ?? 0);
  const shownAvg = Math.round(useCountUp(avgKcal, 600, !!data));

  function goBack() { setOffset((o) => Math.min(o + 1, 52)); }
  function goForward() { setOffset((o) => Math.max(o - 1, 0)); }

  function weekLabel() {
    if (!data) return "";
    const from = new Date(data.start_date + "T00:00:00");
    const to = new Date(data.end_date + "T00:00:00");
    const f = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${f(from)} to ${f(to)}`;
  }

  const targetKcal = settings?.nutrition_targets.target_kcal ?? 2000;
  const days = data?.daily_calories ?? [];
  const loggedDays = days.filter((d) => d.kcal > 0).length;
  const totalDays = Math.max(7, days.length);
  const weekTotal = days.length > 0 ? Math.round(days.reduce((s, d) => s + d.kcal, 0)) : Math.round(avgKcal * 7);
  const figure = shownAvg.toLocaleString("en-US");

  const picker = (
    <div>
      <div role="group" aria-label="Range" className="flex gap-2">
        {([
          { value: "week" as const, label: "Mon to Sun" },
          { value: "last7" as const, label: "Last 7 days" },
        ]).map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={mode === opt.value}
            onClick={() => { setMode(opt.value); setOffset(0); }}
            className={`${CHIP} ${mode === opt.value ? "border-ink bg-ink text-g0" : "border-g3 text-g5 hover:border-g5 hover:text-ink"}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between border-y border-g2 py-1">
        <button type="button" onClick={goBack} disabled={offset >= 52} aria-label="Previous week" className={`${ICON_BTN} -ml-3`}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-[17px] font-medium tabular-nums text-ink">
          {data ? weekLabel() : "\u00a0"}
          {data && offset === 0 && <span className="ml-2 text-[12px] font-normal text-g4">current</span>}
        </span>
        <button type="button" onClick={goForward} disabled={offset <= 0} aria-label="Next week" className={`${ICON_BTN} -mr-3`}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  );

  return (
    <DashboardLayout title="Weekly">
      {isError ? (
        <ErrorState message={getErrorMessage(error, "Couldn't load the weekly summary.")} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <div role="status" aria-label="Loading the week">
          {picker}
          <div className="flex min-h-[172px] flex-col justify-end gap-3 py-5 min-[400px]:min-h-[196px] sm:min-h-[260px]">
            <div className="h-3 w-24 rounded-sm bg-g2 animate-pulse" />
            <div className="h-24 w-56 rounded-sm bg-g1 animate-pulse" />
          </div>
          <div className="grid grid-cols-3 divide-x divide-g2 border-y border-g2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2 px-3 py-3 first:pl-0">
                <div className="h-3 w-14 rounded-sm bg-g2 animate-pulse" />
                <div className="h-6 w-12 rounded-sm bg-g1 animate-pulse" />
              </div>
            ))}
          </div>
          <div className="mt-6 clay-card space-y-4 px-5 py-5">
            <div className="h-4 w-28 rounded-sm bg-g3/60 animate-pulse" />
            <div className="h-[200px] rounded-sm bg-g2 animate-pulse" />
          </div>
        </div>
      ) : (
        <div>
          {picker}

          {/* Hero: the week's one number, the average kcal a day */}
          <div>
            <div className="flex min-h-[172px] flex-col justify-end py-5 min-[400px]:min-h-[196px] sm:min-h-[260px]">
              {loggedDays === 0 ? (
                <>
                  <p className="text-[22px] font-semibold tracking-[-0.01em] text-ink">Nothing logged this week</p>
                  <p className="mt-1 text-[15px] text-g4">Log a meal on Today and the week fills in here.</p>
                </>
              ) : (
                <>
                  <p className="text-[12px] text-g4">Average per day</p>
                  <p
                    className={`mt-2 font-bold leading-[0.8] tracking-[-0.045em] text-ink tabular-nums ${
                      figure.length <= 3 ? "text-[6.5rem] min-[400px]:text-[7.5rem] sm:text-[8.5rem]" : "text-[5.5rem] min-[400px]:text-[6.25rem] sm:text-[8rem]"
                    }`}
                  >
                    {figure}
                  </p>
                  <p className="mt-3 text-[13px] tabular-nums text-g5">
                    kcal a day, target {targetKcal.toLocaleString("en-US")},{" "}
                    <span className="text-ink">{gapPhrase(avgKcal, targetKcal)}</span>
                  </p>
                </>
              )}
            </div>
            <dl className="grid grid-cols-3 divide-x divide-g2 border-y border-g2">
              <div className="py-3 pr-3">
                <dt className="text-[12px] text-g4">Total</dt>
                <dd className="mt-0.5 whitespace-nowrap"><span className="text-[22px] font-medium tabular-nums text-ink">{weekTotal.toLocaleString("en-US")}</span><span className="ml-0.5 text-[12px] text-g4">kcal</span></dd>
              </div>
              <div className="px-3 py-3">
                <dt className="text-[12px] text-g4">Weight change</dt>
                <dd className="mt-0.5 whitespace-nowrap">
                  {data.weight.delta != null ? (
                    <><span className="text-[22px] font-medium tabular-nums text-ink">{data.weight.delta > 0 ? "+" : ""}{fmt(data.weight.delta)}</span><span className="ml-0.5 text-[12px] text-g4">kg</span></>
                  ) : (
                    <span className="text-[22px] font-medium text-g4">--</span>
                  )}
                </dd>
              </div>
              <div className="px-3 py-3">
                <dt className="text-[12px] text-g4">Days logged</dt>
                <dd className="mt-0.5 whitespace-nowrap"><span className="text-[22px] font-medium tabular-nums text-ink">{loggedDays}</span><span className="ml-0.5 text-[12px] text-g4">/{totalDays}</span></dd>
              </div>
            </dl>
          </div>

          {/* Ruled sections, each a predictable grid; the calorie bars take the full row and a
              hidden nutrient's card just drops out */}
          <div className="mt-6">
            <SectionGroup title="Energy" swatches={[plateOf("protein"), plateOf("carbs"), plateOf("fat")]}>
              <CalorieChartCard dailyAvgKcal={data.daily_avg.kcal} targetKcal={targetKcal} dailyData={data.daily_calories} />
              <MacroAveragesCard dailyAvg={data.daily_avg} targets={settings?.nutrition_targets} />
            </SectionGroup>
            {(shows("water") || shows("caffeine")) && (
              <SectionGroup title="Drinks" swatches={[plateOf("water"), plateOf("caffeine")]}>
                <HydrationWeeklyCard
                  dailyWater={data.daily_water ?? []}
                  dailyCaffeine={data.daily_caffeine ?? []}
                  targetWater={settings?.nutrition_targets?.target_water_ml ?? 2500}
                  targetCaffeine={settings?.nutrition_targets?.target_caffeine_mg ?? 400}
                />
              </SectionGroup>
            )}
            {MICRO_KEYS.some(shows) && (
              <SectionGroup title="Vitamins and minerals">
                <MicronutrientSummaryCard
                  microAvg={data.micronutrient_avg}
                  microTargets={settings?.micronutrient_targets}
                  dateRange={{ from: data.start_date, to: data.end_date }}
                />
              </SectionGroup>
            )}
            <SectionGroup title="Body">
              <WeightTrendCard weight={data.weight} bodyComp={data.body_comp} goalKg={settings?.nutrition_targets.target_weight_kg} />
              {data.body_comp.length > 0 && <BodyCompCard data={data.body_comp} />}
            </SectionGroup>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
