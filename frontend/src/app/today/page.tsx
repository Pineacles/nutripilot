"use client";

import { useTodaySummary } from "@/hooks/use-summary";
import { useSettings } from "@/hooks/use-settings";
import { DashboardLayout } from "@/components/dashboard-layout";
import { CalorieRingCard } from "@/components/macro-ring";
import { MacroBreakdownCard } from "@/components/macro-breakdown";
import { QuickStatsCard } from "@/components/quick-stats";
import { HydrationCard } from "@/components/hydration-card";
import { MealsLogCard } from "@/components/meals-list";
import { SupplementsCard } from "@/components/supplement-checklist";

export default function TodayPage() {
  const { data, loading } = useTodaySummary();
  const { data: settings } = useSettings();

  const hasMeals = data && data.meals.length > 0;
  const hasSupplements = data && data.supplements.length > 0;

  return (
    <DashboardLayout title="Daily Overview">
      {/* Date header */}
      <p className="text-lg font-medium text-muted-foreground -mt-4 mb-4">
        {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      </p>

      {loading || !data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="clay-card p-5 space-y-4 animate-pulse">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min">
          <CalorieRingCard totals={data.totals} targets={data.targets} />
          <MacroBreakdownCard totals={data.totals} targets={data.targets} />
          <QuickStatsCard data={data} />

          {data.water && data.caffeine && (
            <HydrationCard water={data.water} caffeine={data.caffeine} />
          )}

          {hasMeals && <MealsLogCard meals={data.meals} />}

          {hasSupplements && (
            <SupplementsCard
              supplements={data.supplements}
              definitions={settings?.supplement_definitions}
              microTargets={settings?.micronutrient_targets}
            />
          )}

          {/* Empty state */}
          {!hasMeals && !hasSupplements && (
            <div className="clay-card p-8 text-center lg:col-span-3">
              <p className="text-muted-foreground text-sm">Nothing logged yet today. Your agent will populate this.</p>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
