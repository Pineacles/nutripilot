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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-card border border-border p-5 space-y-4 animate-pulse">
              <div className="h-3 w-24 rounded bg-muted" />
              <div className="h-32 rounded-xl bg-muted" />
              <div className="space-y-2">
                <div className="h-2 w-full rounded bg-muted" />
                <div className="h-2 w-3/4 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Row 1: 3 equal columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <CalorieRingCard totals={data.totals} targets={data.targets} />
            <MacroBreakdownCard totals={data.totals} targets={data.targets} />
            <QuickStatsCard data={data} />
          </div>

          {/* Row 2: Meals + Supplements (only if data exists) */}
          {(hasMeals || hasSupplements) && (
            <div className={`grid gap-4 grid-cols-1 ${hasMeals && hasSupplements ? "md:grid-cols-2 lg:grid-cols-3" : ""}`}>
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
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground text-sm">Nothing logged yet today. Your agent will populate this.</p>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
