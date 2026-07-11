"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/hooks/queries";
import { invalidateDaySummaries } from "./shared";
import type { WeightLogCreateInput, WeightLogRow, WeightLogUpdateInput } from "@/lib/types";

function invalidateWeight(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.weightLogListAll() });
  queryClient.invalidateQueries({ queryKey: ["weight-logs"] });
  invalidateDaySummaries(queryClient);
}

export function useLogWeight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WeightLogCreateInput) =>
      apiFetch<WeightLogRow>("/api/agent/log/weight", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateWeight(queryClient),
  });
}

export function useUpdateWeightLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & WeightLogUpdateInput) =>
      apiFetch<WeightLogRow>(`/api/agent/log/weight/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateWeight(queryClient),
  });
}

export function useDeleteWeightLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/agent/log/weight/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateWeight(queryClient),
  });
}
