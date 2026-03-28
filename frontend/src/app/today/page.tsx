"use client";

import { useTodaySummary } from "@/hooks/use-summary";
import { DashboardLayout } from "@/components/dashboard-layout";
import { CalorieRingCard } from "@/components/macro-ring";
import { MacroBreakdownCard } from "@/components/macro-breakdown";
import { QuickStatsCard } from "@/components/quick-stats";
import { MealsLogCard } from "@/components/meals-list";
import { SupplementsCard } from "@/components/supplement-checklist";

export default function TodayPage() {
  const { data, loading } = useTodaySummary();

  return (
    <DashboardLayout title="Daily Overview">
      {loading || !data ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#22c55e] border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Row 1: 3 equal columns */}
          <div className="grid grid-cols-3 gap-4">
            <CalorieRingCard totals={data.totals} targets={data.targets} />
            <MacroBreakdownCard totals={data.totals} targets={data.targets} />
            <QuickStatsCard data={data} />
          </div>

          {/* Row 2: Meals (2/3) + Supplements (1/3) */}
          <div className="grid grid-cols-3 gap-4">
            <MealsLogCard meals={data.meals} />
            <SupplementsCard supplements={data.supplements} />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
