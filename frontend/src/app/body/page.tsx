"use client";

import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useStats, useSettings, useWeightLogList } from "@/hooks/queries";
import { useBodyDerived } from "@/hooks/use-body-derived";
import { getErrorMessage } from "@/lib/api";
import { ErrorState } from "@/components/ui/error-state";
import { MeasurementsList } from "@/components/body/measurements-list";
import { Plus } from "lucide-react";
import { PeriodSelector } from "@/components/body/period-selector";
import { HeroStats } from "@/components/body/hero-stats";
import { BodySkeleton } from "@/components/body/body-skeleton";
import { CompositionCard } from "@/components/body/composition-card";
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
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading: loading, isError, error, refetch } = useStats(days);
  const { data: settings } = useSettings();
  // Goal progress is measured from the earliest entries on record, not the chart period.
  const { data: allLogs } = useWeightLogList();
  const { startingWeightAll, startingBfAll } = useMemo(() => {
    const sorted = [...(allLogs ?? [])].sort((a, b) => a.date.localeCompare(b.date));
    return {
      startingWeightAll: sorted[0]?.weight_kg ?? null,
      startingBfAll: sorted.find((r) => r.body_fat_pct != null)?.body_fat_pct ?? null,
    };
  }, [allLogs]);

  const {
    enrichedData,
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

  if (loading && !data) return <DashboardLayout title="Body" hideTitle><BodySkeleton /></DashboardLayout>;

  if (isError && !data) {
    return (
      <DashboardLayout title="Body">
        <ErrorState message={getErrorMessage(error, "Couldn't load body data. Check your connection and try again.")} onRetry={() => refetch()} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Body" hideTitle>
      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">Body</h1>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-g3 px-4 text-[13px] font-medium text-ink transition-colors hover:border-g5 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Add measurement
          </button>
        </div>

        <div className="mt-4">
          <PeriodSelector
            activePreset={activePreset}
            onPreset={(d) => { setActivePreset(d); setDays(d); }}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFrom={setCustomFrom}
            onCustomTo={setCustomTo}
            onApplyCustomRange={applyCustomRange}
          />
        </div>

        <HeroStats
          currentWeight={currentWeight}
          weightChange={weightChange}
          days={days}
          currentBf={currentBf}
          currentFatKg={currentFatKg}
          fatKgChange={fatKgChange}
          currentMuscle={currentMuscle}
          currentMuscleKg={currentMuscleKg}
          muscleKgChange={muscleKgChange}
          bmi={bmi}
          weeklyAvgChange={weeklyAvgChange}
          targetWeight={targetWeight}
        />

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 md:gap-4">
          <MetricTrendCard
            title="Weight" span="lg:col-span-2" data={enrichedData} hasData={enrichedData.length > 0}
            emptyMessage="No weight logged in this period. Pick a longer one or add a measurement."
            dataKey="weight_kg" avgKey="weight_kg_avg" height={260} valueSuffix=" kg" alwaysDots referenceValue={targetWeight}
          />
          <WeightStatsCard
            startingWeight={startingWeight}
            lowestWeight={lowestWeight}
            highestWeight={highestWeight}
            weightChange={weightChange}
            weeklyAvgChange={weeklyAvgChange}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 md:mt-4 md:gap-4">
          <CompositionCard data={enrichedData} span="lg:col-span-2" />
          <CompositionDonutCard compositionDonut={compositionDonut} />
        </div>

        <div className="md:mt-4">
          <MeasurementsList onAdd={() => setAddOpen(true)} addOpen={addOpen} onAddOpenChange={setAddOpen} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 md:mt-4 md:gap-4">
          <MilestonesCard
            targetWeight={targetWeight}
            targetBf={targetBf}
            currentWeight={currentWeight}
            startingWeight={startingWeightAll}
            currentBf={currentBf}
            startingBf={startingBfAll}
          />
          <RateOfChangeCard weeklyRateData={weeklyRateData} weeklyAvgChange={weeklyAvgChange} />
        </div>

        <div className="md:mt-4">
          <ProgressOverviewCard enrichedData={enrichedData} />
        </div>
      </div>
    </DashboardLayout>
  );
}
