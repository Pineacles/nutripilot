"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import { useTodaySummary } from "@/hooks/use-summary";
import { NavBar } from "@/components/nav-bar";
import { MacroRing, MacroLegend } from "@/components/macro-ring";
import { CalorieBar } from "@/components/calorie-bar";
import { MealsList } from "@/components/meals-list";
import { SupplementChecklist } from "@/components/supplement-checklist";

export default function TodayPage() {
  const router = useRouter();
  const { data, loading } = useTodaySummary();

  useEffect(() => {
    if (!isLoggedIn()) router.replace("/login");
  }, [router]);

  if (loading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#4f9cf9] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-24 pt-8">
      <h1 className="text-lg font-semibold mb-6">Today</h1>

      <MacroRing totals={data.totals} targets={data.targets} />
      <MacroLegend totals={data.totals} targets={data.targets} />

      <div className="mt-6 space-y-4">
        <CalorieBar current={data.totals.kcal} target={data.targets.kcal} />
        <MealsList meals={data.meals} />
        <SupplementChecklist supplements={data.supplements} />
      </div>

      <NavBar />
    </div>
  );
}
