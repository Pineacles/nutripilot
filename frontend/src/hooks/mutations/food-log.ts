"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/hooks/queries";
import { invalidateDaySummaries } from "./shared";
import type {
  FoodLogByBarcodeCreateInput,
  FoodLogCreateInput,
  FoodLogCreateResponse,
  FoodLogUpdateInput,
} from "@/lib/types";

function invalidateFoodLog(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.foodLogDayAll() });
  invalidateDaySummaries(queryClient);
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
