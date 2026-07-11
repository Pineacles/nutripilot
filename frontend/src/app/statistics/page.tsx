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
import { WeightHistoryCard } from "@/components/statistics/weight-history-card";
import { BodyCompTrendCard } from "@/components/statistics/body-comp-trend-card";
import { CalorieTrendCard } from "@/components/statistics/calorie-trend-card";
import { MacroDistributionCard } from "@/components/statistics/macro-distribution-card";
import { MacroTrendsCard } from "@/components/statistics/macro-trends-card";
import { NutrientTrendCard } from "@/components/statistics/nutrient-trend-card";
import { WaterTrendCard } from "@/components/statistics/water-trend-card";
import { CaffeineTrendCard } from "@/components/statistics/caffeine-trend-card";
import { MicronutrientAveragesCard } from "@/components/statistics/micronutrient-averages-card";
import { SupplementConsistencyCard } from "@/components/statistics/supplement-consistency-card";
import { RecordsCard } from "@/components/statistics/records-card";
import { CHART_COLORS } from "@/lib/chart-theme";

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
  // Nullable — goal reference line is hidden entirely when no goal weight is set.
  const targetWeight = settings?.nutrition_targets?.target_weight_kg ?? null;

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
        <StatisticsSkeleton />
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
      <PeriodSelector
        activePreset={activePreset}
        onPreset={(d) => { setActivePreset(d); setDays(d); setCustomFrom(""); setCustomTo(""); }}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFrom={setCustomFrom}
        onCustomTo={setCustomTo}
        onApplyCustomRange={applyCustomRange}
      />

      <HeroStats data={data} avgKcal={avgKcal} targetKcal={targetKcal} logPct={logPct} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        <WeightHistoryCard weightData={weightData} targetWeight={targetWeight} />
        <BodyCompTrendCard bodyCompData={bodyCompData} />

        <CalorieTrendCard nutritionLength={nutrition.length} rollingNutrition={rollingNutrition} targetKcal={targetKcal} />
        <MacroDistributionCard macroAvg={data.macro_avg} />

        <MacroTrendsCard
          nutritionLength={nutrition.length}
          rollingNutrition={rollingNutrition}
          targetProtein={targetProtein}
          targetCarbs={targetCarbs}
          targetFat={targetFat}
        />

        <NutrientTrendCard title="Fiber" dataKey="fiber" unit="g" color={CHART_COLORS.green} target={targetFiber} nutritionLength={nutrition.length} rollingNutrition={rollingNutrition} />
        <NutrientTrendCard title="Sugar" dataKey="sugar" unit="g" color={CHART_COLORS.pink} target={targetSugar} nutritionLength={nutrition.length} rollingNutrition={rollingNutrition} />
        <NutrientTrendCard title="Sodium" dataKey="sodium" unit="mg" color={CHART_COLORS.orange} target={targetSodium} nutritionLength={nutrition.length} rollingNutrition={rollingNutrition} />

        <NutrientTrendCard
          title="Alcohol"
          dataKey="alcohol"
          unit="g"
          color={CHART_COLORS.orange}
          target={targetAlcohol}
          showReferenceLine={targetAlcohol > 0}
          nutritionLength={nutrition.length}
          rollingNutrition={rollingNutrition}
        />
        <WaterTrendCard dailyWater={data.daily_water} targetWaterMl={targetWaterMl} />
        <CaffeineTrendCard dailyCaffeine={data.daily_caffeine} targetCaffeineMg={targetCaffeineMg} />

        <MicronutrientAveragesCard microAvg={data.micro_avg} />

        <SupplementConsistencyCard supplementLog={data.supplement_log} days={days} />
        <RecordsCard data={data} />
      </div>
    </DashboardLayout>
  );
}
