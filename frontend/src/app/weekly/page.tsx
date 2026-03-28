"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import { useWeekSummary } from "@/hooks/use-summary";
import { NavBar } from "@/components/nav-bar";
import { CalorieChart } from "@/components/calorie-chart";
import { WeightTrend } from "@/components/weight-trend";
import { MacroAverages } from "@/components/macro-averages";

export default function WeeklyPage() {
  const router = useRouter();
  const { data, loading } = useWeekSummary();

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
      <h1 className="text-lg font-semibold mb-6">Weekly</h1>

      <div className="space-y-4">
        <MacroAverages dailyAvg={data.daily_avg} />
        <CalorieChart dailyAvgKcal={data.daily_avg.kcal} targetKcal={2000} />
        <WeightTrend weight={data.weight} goalKg={78} />
      </div>

      <NavBar />
    </div>
  );
}
