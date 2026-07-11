"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/hooks/queries";
import { invalidateDaySummaries } from "./shared";
import type { SupplementIntakeLog, SupplementLogCreateInput, SupplementLogUpdateInput } from "@/lib/types";

function invalidateSupplementLog(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.supplementLogDayAll() });
  invalidateDaySummaries(queryClient);
}

/** Record that a supplement was taken (mirrors a supplement definition's name/dose/unit/timing). */
export function useLogSupplementIntake() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SupplementLogCreateInput) =>
      apiFetch<SupplementIntakeLog>("/api/agent/log/supplement", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateSupplementLog(queryClient),
  });
}

export function useUpdateSupplementLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & SupplementLogUpdateInput) =>
      apiFetch<SupplementIntakeLog>(`/api/agent/log/supplement/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateSupplementLog(queryClient),
  });
}

/** Delete a supplement intake log — used both for explicit delete and "undo" after mark-taken. */
export function useDeleteSupplementLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/agent/log/supplement/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateSupplementLog(queryClient),
  });
}
