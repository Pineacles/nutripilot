"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useStats, useSettings } from "@/hooks/queries";
import { useBodyDerived } from "@/hooks/use-body-derived";
import { getErrorMessage } from "@/lib/api";
import { ErrorState } from "@/components/ui/error-state";
import { MeasurementsList } from "@/components/body/measurements-list";
import { CHART_COLORS } from "@/lib/chart-theme";
import { PeriodSelector } from "@/components/body/period-selector";
import { HeroStats } from "@/components/body/hero-stats";
import { BodySkeleton } from "@/components/body/body-skeleton";
import { MetricTrendCard } from "@/components/body/metric-trend-card";
import { WeightStatsCard } from "@/components/body/weight-stats-card";
import { CompositionDonutCard } from "@/components/body/composition-donut-card";
import { ProgressOverviewCard } from "@/components/body/progress-overview-card";
import { MilestonesCard } from "@/components/body/milestones-card";
import { RateOfChangeCard } from "@/components/body/rate-of-change-card";

export default function BodyCompositionPage() {
  const [days, setDays] = useState(90);
  const [activePreset, setActivePreset] = useState(90);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { data, isLoading: loading, isError, error, refetch } = useStats(days);
  const { data: settings } = useSettings();

  const {
    enrichedData, validBf,
    currentWeight, startingWeight, weightChange, lowestWeight, highestWeight,
    currentBf, currentFatKg, fatKgChange,
    currentMuscle, currentMuscleKg, muscleKgChange,
    bmi, weeklyAvgChange,
    compositionDonut, weeklyRateData,
  } = useBodyDerived(data, days);

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

  // Targets: nullable; goal lines/progress are hidden entirely when unset.
  const targetWeight = settings?.nutrition_targets.target_weight_kg ?? null;
  const targetBf = settings?.nutrition_targets.target_body_fat_pct ?? null;

  if (loading && !data) return <DashboardLayout title="Body Composition"><BodySkeleton /></DashboardLayout>;

  if (isError && !data) {
    return (
      <DashboardLayout title="Body Composition">
        <ErrorState message={getErrorMessage(error, "Couldn't load body composition data.")} onRetry={() => refetch()} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Body Composition">
      <div className="space-y-6">
        <PeriodSelector
          activePreset={activePreset}
          onPreset={(d) => { setActivePreset(d); setDays(d); }}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFrom={setCustomFrom}
          onCustomTo={setCustomTo}
          onApplyCustomRange={applyCustomRange}
        />

        <MeasurementsList />

        <HeroStats
          currentWeight={currentWeight}
          weightChange={weightChange}
          currentBf={currentBf}
          currentFatKg={currentFatKg}
          fatKgChange={fatKgChange}
          currentMuscle={currentMuscle}
          currentMuscleKg={currentMuscleKg}
          muscleKgChange={muscleKgChange}
          bmi={bmi}
          weeklyAvgChange={weeklyAvgChange}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <MetricTrendCard
            title="Weight Trend" span="lg:col-span-2" data={enrichedData} hasData={enrichedData.length > 0}
            emptyMessage="No weight data for this period" gradientId="weightGrad" dataKey="weight_kg" avgKey="weight_kg_avg"
            color={CHART_COLORS.green} height={280} valueSuffix=" kg" referenceValue={targetWeight}
          />
          <WeightStatsCard
            startingWeight={startingWeight}
            currentWeight={currentWeight}
            lowestWeight={lowestWeight}
            highestWeight={highestWeight}
            weightChange={weightChange}
            weeklyAvgChange={weeklyAvgChange}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <MetricTrendCard
            title="Body Fat % Trend" data={enrichedData} hasData={enrichedData.some(d => d.body_fat_pct != null)}
            emptyMessage="No body fat data" gradientId="bfGrad" dataKey="body_fat_pct" avgKey="body_fat_pct_avg"
            color={CHART_COLORS.amber} height={220} tickMaxLabels={5} valueSuffix="%"
          />
          <MetricTrendCard
            title="Muscle Mass % Trend" data={enrichedData} hasData={enrichedData.some(d => d.muscle_mass_pct != null)}
            emptyMessage="No muscle mass data" gradientId="muscleGrad" dataKey="muscle_mass_pct" avgKey="muscle_mass_pct_avg"
            color={CHART_COLORS.blue} height={220} tickMaxLabels={5} valueSuffix="%"
          />
          <CompositionDonutCard compositionDonut={compositionDonut} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <MetricTrendCard
            title="Fat Mass (kg)" data={enrichedData} hasData={enrichedData.some(d => d.body_fat_kg != null)}
            emptyMessage="No fat mass data" gradientId="fatKgGrad" dataKey="body_fat_kg" avgKey="body_fat_kg_avg"
            color={CHART_COLORS.amber} height={220} tickMaxLabels={6} valueSuffix=" kg"
          />
          <MetricTrendCard
            title="Muscle Mass (kg)" data={enrichedData} hasData={enrichedData.some(d => d.muscle_mass_kg != null)}
            emptyMessage="No muscle mass data" gradientId="muscleKgGrad" dataKey="muscle_mass_kg" avgKey="muscle_mass_kg_avg"
            color={CHART_COLORS.blue} height={220} tickMaxLabels={6} valueSuffix=" kg"
          />
        </div>

        <ProgressOverviewCard enrichedData={enrichedData} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <MilestonesCard
            targetWeight={targetWeight}
            targetBf={targetBf}
            currentWeight={currentWeight}
            startingWeight={startingWeight}
            currentBf={currentBf}
            validBf={validBf}
          />
          <RateOfChangeCard weeklyRateData={weeklyRateData} weeklyAvgChange={weeklyAvgChange} />
        </div>
      </div>
    </DashboardLayout>
  );
}
