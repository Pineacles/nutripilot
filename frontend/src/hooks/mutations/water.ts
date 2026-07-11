"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/hooks/queries";
import { invalidateDaySummaries } from "./shared";
import type { WaterLogCreateInput, WaterLogRow, WaterLogUpdateInput } from "@/lib/types";

function invalidateWater(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.waterLogDayAll() });
  invalidateDaySummaries(queryClient);
}

export function useLogWater() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WaterLogCreateInput) =>
      apiFetch<WaterLogRow>("/api/agent/log/water", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateWater(queryClient),
  });
}

export function useUpdateWaterLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & WaterLogUpdateInput) =>
      apiFetch<WaterLogRow>(`/api/agent/log/water/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateWater(queryClient),
  });
}

export function useDeleteWaterLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/agent/log/water/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateWater(queryClient),
  });
}
