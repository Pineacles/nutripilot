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
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#22c55e] border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Row 1: Calorie chart (2/3) + Weight trend (1/3) */}
          <div className="grid grid-cols-3 gap-4">
            <CalorieChartCard
              dailyAvgKcal={data.daily_avg.kcal}
              targetKcal={settings?.nutrition_targets.target_kcal ?? 2000}
            />
            <WeightTrendCard weight={data.weight} goalKg={78} />
          </div>

          {/* Row 2: Body composition — fat % + muscle % */}
          {data.body_comp.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <BodyFatCard data={data.body_comp} />
              <MuscleCard data={data.body_comp} />
            </div>
          )}

          {/* Row 3: Macro averages + Micronutrient summary */}
          <div className="grid grid-cols-2 gap-4">
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
