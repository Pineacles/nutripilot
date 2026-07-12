"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/hooks/queries";
import type { Integration, IntegrationCreateInput, IntegrationUpdateInput } from "@/lib/types";

function invalidateIntegrations(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.integrations() });
}

// These mutate through /api/agent/integrations rather than /api/v1/integrations:
// the settings router only exposes a read-only GET; create/update/delete/sync live
// under the agent router (also JWT-accessible per the Phase 5 auth change).
export function useCreateIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: IntegrationCreateInput) =>
      apiFetch<Integration>("/api/agent/integrations", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateIntegrations(queryClient),
  });
}

export function useUpdateIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & IntegrationUpdateInput) =>
      apiFetch<Integration>(`/api/agent/integrations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateIntegrations(queryClient),
  });
}

export function useDeleteIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/agent/integrations/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateIntegrations(queryClient),
  });
}

export function useSyncIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean; entries_synced: number }>(`/api/agent/integrations/${id}/sync`, {
        method: "POST",
      }),
    onSuccess: () => invalidateIntegrations(queryClient),
  });
}
