"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useStats, useSettings } from "@/hooks/queries";
import { getErrorMessage } from "@/lib/api";
import { ErrorState } from "@/components/ui/error-state";
import { computeRollingAvg, type DailyNutritionLike } from "@/lib/chart-utils";
import { PeriodSelector } from "@/components/statistics/period-selector";
import { HeroStats } from "@/components/statistics/hero-stats";
import { StatisticsSkeleton } from "@/components/statistics/statistics-skeleton";
import { Scorecard } from "@/components/statistics/scorecard";

export default function StatisticsPage() {
  const [days, setDays] = useState(90);
  const [activePreset, setActivePreset] = useState(90);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { data, isLoading: loading, isError, error, refetch } = useStats(days);
  const { data: settings } = useSettings();

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

  /* ─── Error / Loading States ─── */

  if (isError && !data) {
    return (
      <DashboardLayout title="Statistics">
        <ErrorState message={getErrorMessage(error, "Couldn't load analytics data.")} onRetry={() => refetch()} />
      </DashboardLayout>
    );
  }

  if (loading || !data) {
    return (
      <DashboardLayout title="Statistics">
        <StatisticsSkeleton />
      </DashboardLayout>
    );
  }

  const nutrition = data.daily_nutrition ?? [];
  const rollingNutrition = computeRollingAvg(nutrition as DailyNutritionLike[], ["kcal", "protein", "carbs", "fat", "fiber", "sugar", "sodium", "alcohol"]);
  const avgKcal = data.avg_daily_kcal ?? (nutrition.length > 0 ? Math.round(nutrition.reduce((s, d) => s + d.kcal, 0) / nutrition.length) : 0);

  return (
    <DashboardLayout title="Statistics">
      <PeriodSelector
        activePreset={activePreset}
        onPreset={(d) => { setActivePreset(d); setDays(d); setCustomFrom(""); setCustomTo(""); }}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFrom={setCustomFrom}
        onCustomTo={setCustomTo}
        onApplyCustomRange={applyCustomRange}
      />

      <HeroStats data={data} avgKcal={avgKcal} targetKcal={targetKcal} />

      <Scorecard
        data={data}
        nutrition={nutrition}
        rolling={rollingNutrition}
        days={days}
        targets={{
          kcal: targetKcal,
          protein: targetProtein,
          carbs: targetCarbs,
          fat: targetFat,
          fiber: targetFiber,
          sugar: targetSugar,
          sodium: targetSodium,
          alcohol: targetAlcohol,
          waterMl: targetWaterMl,
          caffeineMg: targetCaffeineMg,
        }}
      />
    </DashboardLayout>
  );
}
