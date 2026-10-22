"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/hooks/queries";
import { invalidateDaySummaries } from "./shared";
import type {
  FoodDetail,
  FoodLogByBarcodeCreateInput,
  FoodLogCopyInput,
  FoodLogCreateInput,
  FoodLogCreateResponse,
  FoodLogUpdateInput,
  Serving,
} from "@/lib/types";

function invalidateFoodLog(queryClient: ReturnType<typeof useQueryClient>) {
  invalidateDaySummaries(queryClient);
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.foodLogDayAll() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.recentFoods() }),
  ]);
}

/** Log a food entry by its known food_id (search result, or after a barcode lookup). */
export function useLogFood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FoodLogCreateInput) =>
      apiFetch<FoodLogCreateResponse>("/api/agent/log/food", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateFoodLog(queryClient),
  });
}

/** Log a food entry directly by barcode (scanner page "Log this"). */
export function useLogFoodByBarcode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FoodLogByBarcodeCreateInput) =>
      apiFetch<FoodLogCreateResponse>("/api/agent/log/food-by-barcode", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateFoodLog(queryClient),
  });
}

export function useUpdateFoodLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & FoodLogUpdateInput) =>
      apiFetch<FoodLogCreateResponse>(`/api/agent/log/food/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateFoodLog(queryClient),
  });
}

export function useDeleteFoodLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/agent/log/food/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateFoodLog(queryClient),
  });
}

/** Log a meal (or a whole day) again on another day or meal. Returns the new entries, for undo. */
export function useCopyFoodLogs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FoodLogCopyInput) =>
      apiFetch<FoodLogCreateResponse[]>("/api/agent/log/food/copy", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    // Stays pending until the day has reloaded, so a meal can't be copied twice from a stale chip.
    onSuccess: () => invalidateFoodLog(queryClient),
  });
}

/** Undo for a copy: removes the entries it created in one go. */
export function useRemoveFoodLogs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(ids.map((id) => apiFetch<void>(`/api/agent/log/food/${id}`, { method: "DELETE" }))),
    onSettled: () => invalidateFoodLog(queryClient),
  });
}

/** Add a named serving ("slice" = 30 g) to a food. The open food updates right away. */
export function useAddServing(foodId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { label: string; grams: number }) =>
      apiFetch<Serving>(`/api/foods/${foodId}/servings`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: (serving) => {
      queryClient.setQueryData<FoodDetail>(queryKeys.foodDetail(foodId ?? null), (old) =>
        old ? { ...old, servings: [...(old.servings ?? []), serving].sort((a, b) => a.grams - b.grams) } : old,
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.foodDetail(foodId ?? null) });
    },
  });
}

export function useDeleteServing(foodId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (servingId: string) =>
      apiFetch<void>(`/api/foods/${foodId}/servings/${servingId}`, { method: "DELETE" }),
    onSuccess: (_, servingId) => {
      queryClient.setQueryData<FoodDetail>(queryKeys.foodDetail(foodId ?? null), (old) =>
        old ? { ...old, servings: (old.servings ?? []).filter((s) => s.id !== servingId) } : old,
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.foodDetail(foodId ?? null) });
    },
  });
}
