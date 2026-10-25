"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, useUpdateMicronutrientTargets, useUpdateNutritionTargets } from "@/hooks/queries";
import type { MicronutrientTargetItem, NutritionTargets, UserSettings } from "@/lib/types";

export const DEFAULT_NUTRITION_TARGETS: NutritionTargets = {
  target_kcal: 2000,
  target_protein_g: 150,
  target_carbs_g: 250,
  target_fat_g: 70,
  target_fiber_g: 30,
  target_sugar_g: 50,
  target_sodium_mg: 2300,
  target_alcohol_g: 0,
  target_water_ml: 2500,
  target_caffeine_mg: 400,
  target_weight_kg: null,
  target_body_fat_pct: null,
  timezone: null,
};

export const DEFAULT_MICRO_TARGETS: MicronutrientTargetItem[] = [
  { nutrient: "vitamin_d", target_value: 20, unit: "µg" },
  { nutrient: "zinc", target_value: 10, unit: "mg" },
  { nutrient: "omega3", target_value: 1000, unit: "mg" },
  { nutrient: "creatine", target_value: 5, unit: "g" },
  { nutrient: "fiber", target_value: 30, unit: "g" },
  { nutrient: "iron", target_value: 8, unit: "mg" },
];

/** The targets as the server has them now, or the defaults before the owner ever saved. */
export function nutritionTargetsOf(settings: UserSettings | undefined): NutritionTargets {
  return { ...DEFAULT_NUTRITION_TARGETS, ...(settings?.nutrition_targets ?? {}) };
}

export function microTargetsOf(settings: UserSettings | undefined): MicronutrientTargetItem[] {
  const list = settings?.micronutrient_targets;
  return list && list.length > 0 ? list : DEFAULT_MICRO_TARGETS;
}

// The API takes the whole object each time, so two fields saved in quick succession (tabbing
// through a list) must not overwrite each other: saves run one after another, and each one waits
// for the refetch so the next merges onto what the server really holds.
let nutritionChain: Promise<unknown> = Promise.resolve();
let microChain: Promise<unknown> = Promise.resolve();

/** Save a change to some nutrition target fields; resolves when it is stored, rejects on failure. */
export function useSaveNutritionTargets() {
  const queryClient = useQueryClient();
  const { mutateAsync } = useUpdateNutritionTargets();
  return useCallback(
    (patch: Partial<NutritionTargets>) => {
      const run = nutritionChain
        .catch(() => undefined)
        .then(async () => {
          const settings = queryClient.getQueryData<UserSettings>(queryKeys.settings());
          await mutateAsync({ ...nutritionTargetsOf(settings), ...patch });
          await queryClient.invalidateQueries({ queryKey: queryKeys.settings() });
        });
      nutritionChain = run;
      return run;
    },
    [queryClient, mutateAsync],
  );
}

/** Save one micronutrient target (by its API name); resolves when it is stored. */
export function useSaveMicroTarget() {
  const queryClient = useQueryClient();
  const { mutateAsync } = useUpdateMicronutrientTargets();
  return useCallback(
    (nutrient: string, value: number) => {
      const run = microChain
        .catch(() => undefined)
        .then(async () => {
          const settings = queryClient.getQueryData<UserSettings>(queryKeys.settings());
          const next = microTargetsOf(settings).map((t) => (t.nutrient === nutrient ? { ...t, target_value: value } : t));
          await mutateAsync(next);
          await queryClient.invalidateQueries({ queryKey: queryKeys.settings() });
        });
      microChain = run;
      return run;
    },
    [queryClient, mutateAsync],
  );
}
