"use client";

import { useTodaySummary } from "@/hooks/use-summary";
import { useSettings } from "@/hooks/use-settings";
import { DashboardLayout } from "@/components/dashboard-layout";
import { CalorieRingCard } from "@/components/macro-ring";
import { MacroBreakdownCard } from "@/components/macro-breakdown";
import { QuickStatsCard } from "@/components/quick-stats";
import { MealsLogCard } from "@/components/meals-list";
import { SupplementsCard } from "@/components/supplement-checklist";

export default function TodayPage() {
  const { data, loading } = useTodaySummary();
  const { data: settings } = useSettings();

  const hasMeals = data && data.meals.length > 0;
  const hasSupplements = data && data.supplements.length > 0;

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

          {/* Row 2: Meals + Supplements (only if data exists) */}
          {(hasMeals || hasSupplements) && (
            <div className={`grid gap-4 ${hasMeals && hasSupplements ? "grid-cols-3" : "grid-cols-1"}`}>
              {hasMeals && <MealsLogCard meals={data.meals} />}
              {hasSupplements && (
                <SupplementsCard
                  supplements={data.supplements}
                  definitions={settings?.supplement_definitions}
                  microTargets={settings?.micronutrient_targets}
                />
              )}
            </div>
          )}

          {/* Empty state */}
          {!hasMeals && !hasSupplements && (
            <div className="rounded-2xl border border-white/5 bg-[#1a1a1a] p-8 text-center">
              <p className="text-white/30 text-sm">Nothing logged yet today. Your agent will populate this.</p>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
