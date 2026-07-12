"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/hooks/queries";
import type { FoodCloneInput, FoodCreateInput, FoodDetail, FoodUpdateInput } from "@/lib/types";

function invalidateFoods(queryClient: ReturnType<typeof useQueryClient>, id?: string) {
  // Prefix invalidation: matches every ["foods", "search", ...] query regardless of
  // the current search term/page/limit.
  queryClient.invalidateQueries({ queryKey: ["foods", "search"] });
  if (id) queryClient.invalidateQueries({ queryKey: queryKeys.foodDetail(id) });
}

export function useCreateFood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FoodCreateInput) =>
      apiFetch<FoodDetail>("/api/foods", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateFoods(queryClient),
  });
}

export function useUpdateFood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & FoodUpdateInput) =>
      apiFetch<FoodDetail>(`/api/foods/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, variables) => invalidateFoods(queryClient, variables.id),
  });
}

export function useDeleteFood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/foods/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => invalidateFoods(queryClient, id),
  });
}

export function useCloneFood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & FoodCloneInput) =>
      apiFetch<FoodDetail>(`/api/foods/${id}/clone`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateFoods(queryClient),
  });
}
