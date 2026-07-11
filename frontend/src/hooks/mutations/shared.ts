import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queries";

/**
 * Broad invalidation for anything that can shift daily/weekly aggregates
 * (food, weight, water, or supplement logs). Uses queryKeys' prefix-only
 * entries rather than exact dates because several mutations (date-move on
 * edit) can affect two different days at once, and re-deriving both from
 * mutation variables would be more fragile than just refetching all of them.
 */
export function invalidateDaySummaries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.todayAll() });
  queryClient.invalidateQueries({ queryKey: queryKeys.weeklyAll() });
  queryClient.invalidateQueries({ queryKey: queryKeys.statsAll() });
}
