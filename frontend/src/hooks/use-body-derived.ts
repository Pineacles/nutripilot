"use client";

import { useMemo } from "react";
import { rollingAvg } from "@/lib/body-chart-utils";
import { CHART_COLORS } from "@/lib/chart-theme";
import type { StatsSummary } from "@/lib/types";

/**
 * All the derived (non-fetched) numbers the body-composition page renders —
 * lifted out of the page component so page.tsx stays a thin composition.
 */
export function useBodyDerived(data: StatsSummary | undefined, days: number) {
  // Memoized so a stable reference flows into the useMemo hooks below (data?.weight_history ?? []
  // would otherwise create a new array every render whenever `data` is null/undefined).
  const weightHistory = useMemo(() => data?.weight_history ?? [], [data]);

  const enrichedData = useMemo(() => {
    // Cast to DataRow[] so the generic rollingAvg constraint is satisfied;
    // BodyCompEntry's known fields still flow through via the spread return type.
    let d = rollingAvg(weightHistory, "weight_kg", 7);
    d = rollingAvg(d, "body_fat_pct", 7);
    d = rollingAvg(d, "muscle_mass_pct", 7);
    d = rollingAvg(d, "body_fat_kg", 7);
    d = rollingAvg(d, "muscle_mass_kg", 7);
    return d;
  }, [weightHistory]);

  // Memoize validWeights so weeklyRateData's useMemo dependency is stable
  // (React Compiler requires memoized deps for manual useMemo to be preserved)
  const validWeights = useMemo(() => weightHistory.filter(e => e.weight_kg != null), [weightHistory]);
  const firstWeight = validWeights.length > 0 ? validWeights[0] : null;
  const lastWeight = validWeights.length > 0 ? validWeights[validWeights.length - 1] : null;

  const currentWeight = lastWeight?.weight_kg ?? null;
  const startingWeight = firstWeight?.weight_kg ?? null;
  const weightChange = currentWeight != null && startingWeight != null ? Math.round((currentWeight - startingWeight) * 10) / 10 : null;
  const lowestWeight = validWeights.length > 0 ? Math.min(...validWeights.map(e => e.weight_kg)) : null;
  const highestWeight = validWeights.length > 0 ? Math.max(...validWeights.map(e => e.weight_kg)) : null;

  const validBf = weightHistory.filter(e => e.body_fat_pct != null);
  const currentBf = validBf.length > 0 ? validBf[validBf.length - 1].body_fat_pct : null;

  const validMuscle = weightHistory.filter(e => e.muscle_mass_pct != null);
  const currentMuscle = validMuscle.length > 0 ? validMuscle[validMuscle.length - 1].muscle_mass_pct : null;

  const validFatKg = weightHistory.filter(e => e.body_fat_kg != null);
  const currentFatKg = validFatKg.length > 0 ? validFatKg[validFatKg.length - 1].body_fat_kg : null;
  const startFatKg = validFatKg.length > 0 ? validFatKg[0].body_fat_kg : null;
  const fatKgChange = currentFatKg != null && startFatKg != null ? Math.round((currentFatKg - startFatKg) * 10) / 10 : null;

  const validMuscleKg = weightHistory.filter(e => e.muscle_mass_kg != null);
  const currentMuscleKg = validMuscleKg.length > 0 ? validMuscleKg[validMuscleKg.length - 1].muscle_mass_kg : null;
  const startMuscleKg = validMuscleKg.length > 0 ? validMuscleKg[0].muscle_mass_kg : null;
  const muscleKgChange = currentMuscleKg != null && startMuscleKg != null ? Math.round((currentMuscleKg - startMuscleKg) * 10) / 10 : null;

  const bmi = currentWeight != null ? Math.round((currentWeight / (1.75 * 1.75)) * 10) / 10 : null;

  const weeksInPeriod = days / 7;
  const weeklyAvgChange = weightChange != null && weeksInPeriod > 0
    ? Math.round((weightChange / weeksInPeriod) * 100) / 100
    : null;

  // Body composition donut data
  const compositionDonut = useMemo(() => {
    if (currentBf == null && currentMuscle == null) return [];
    const fat = currentBf ?? 0;
    const muscle = currentMuscle ?? 0;
    const other = Math.max(0, 100 - fat - muscle);
    return [
      { name: "Body Fat", value: fat, color: CHART_COLORS.amber },
      { name: "Muscle", value: muscle, color: CHART_COLORS.blue },
      { name: "Other", value: other, color: "#444" },
    ];
  }, [currentBf, currentMuscle]);

  // Weekly rate of change data
  const weeklyRateData = useMemo(() => {
    if (validWeights.length < 8) return [];
    const rates: { date: string; rate: number }[] = [];
    for (let i = 7; i < validWeights.length; i++) {
      const current = validWeights[i].weight_kg;
      const prev = validWeights[i - 7].weight_kg;
      rates.push({
        date: validWeights[i].date,
        rate: Math.round((current - prev) * 100) / 100,
      });
    }
    return rates;
  }, [validWeights]);

  return {
    enrichedData, validBf,
    currentWeight, startingWeight, weightChange, lowestWeight, highestWeight,
    currentBf, currentFatKg, fatKgChange,
    currentMuscle, currentMuscleKg, muscleKgChange,
    bmi, weeklyAvgChange,
    compositionDonut, weeklyRateData,
  };
}
