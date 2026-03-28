"use client";

import { useWeekSummary } from "@/hooks/use-summary";
import { DashboardLayout } from "@/components/dashboard-layout";
import { CalorieChartCard } from "@/components/calorie-chart";
import { WeightTrendCard } from "@/components/weight-trend";
import { MacroAveragesCard } from "@/components/macro-averages";
import { MicronutrientSummaryCard } from "@/components/micronutrient-summary";

export default function WeeklyPage() {
  const { data, loading } = useWeekSummary();

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
            <CalorieChartCard dailyAvgKcal={data.daily_avg.kcal} targetKcal={2000} />
            <WeightTrendCard weight={data.weight} goalKg={78} />
          </div>

          {/* Row 2: Macro averages + Micronutrient summary */}
          <div className="grid grid-cols-2 gap-4">
            <MacroAveragesCard dailyAvg={data.daily_avg} />
            <MicronutrientSummaryCard microAvg={data.micronutrient_avg} />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
