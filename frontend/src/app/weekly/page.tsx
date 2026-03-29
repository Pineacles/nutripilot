"use client";

import { useWeekSummary } from "@/hooks/use-summary";
import { useSettings } from "@/hooks/use-settings";
import { DashboardLayout } from "@/components/dashboard-layout";
import { CalorieChartCard } from "@/components/calorie-chart";
import { WeightTrendCard } from "@/components/weight-trend";
import { MacroAveragesCard } from "@/components/macro-averages";
import { MicronutrientSummaryCard } from "@/components/micronutrient-summary";
import { BodyFatCard, MuscleCard } from "@/components/body-comp";

export default function WeeklyPage() {
  const { data, loading } = useWeekSummary();
  const { data: settings } = useSettings();

  return (
    <DashboardLayout title="Weekly Overview">
      {loading || !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-card border border-border p-5 space-y-4 animate-pulse">
                <div className="h-3 w-28 rounded bg-muted" />
                <div className="h-40 rounded-xl bg-muted" />
                <div className="space-y-2">
                  <div className="h-2 w-full rounded bg-muted" />
                  <div className="h-2 w-2/3 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-card border border-border p-5 space-y-4 animate-pulse">
                <div className="h-3 w-24 rounded bg-muted" />
                <div className="h-28 rounded-xl bg-muted" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Row 1: Calorie chart (2/3) + Weight trend (1/3) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <CalorieChartCard
              dailyAvgKcal={data.daily_avg.kcal}
              targetKcal={settings?.nutrition_targets.target_kcal ?? 2000}
            />
            <WeightTrendCard weight={data.weight} goalKg={78} />
          </div>

          {/* Row 2: Body composition -- fat % + muscle % */}
          {data.body_comp.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <BodyFatCard data={data.body_comp} />
              <MuscleCard data={data.body_comp} />
            </div>
          )}

          {/* Row 3: Macro averages + Micronutrient summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MacroAveragesCard dailyAvg={data.daily_avg} />
            <MicronutrientSummaryCard
              microAvg={data.micronutrient_avg}
              microTargets={settings?.micronutrient_targets}
            />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
