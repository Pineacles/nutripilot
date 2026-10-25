import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { trackableKey } from "@/lib/nutrients";
import type { UserSettings } from "@/lib/types";
import { queryKeys, useSettings } from "./queries";

/** Which nutrients the owner wants to see. Everything shows until settings have loaded. */
export function useTracked() {
  const { data } = useSettings();
  const hidden = useMemo(() => new Set(data?.hidden_nutrients ?? []), [data?.hidden_nutrients]);
  const shows = useCallback((name: string) => !hidden.has(trackableKey(name)), [hidden]);
  return { hidden, shows };
}

export function useUpdateTrackedNutrients() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (hidden: string[]) =>
      apiFetch<{ hidden: string[] }>("/api/v1/settings/tracked-nutrients", {
        method: "PUT",
        body: JSON.stringify({ hidden }),
      }),
    // Switches answer at once; a failed save puts the old list back.
    onMutate: async (hidden) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.settings() });
      const before = queryClient.getQueryData<UserSettings>(queryKeys.settings());
      if (before) queryClient.setQueryData(queryKeys.settings(), { ...before, hidden_nutrients: hidden });
      return { before };
    },
    onError: (_err, _hidden, ctx) => {
      if (ctx?.before) queryClient.setQueryData(queryKeys.settings(), ctx.before);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.settings() }),
  });
}
