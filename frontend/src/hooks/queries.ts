"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  DailyFoodLogResponse,
  FoodDetail,
  FoodsSearchPage,
  Integration,
  MicronutrientTargetItem,
  NutritionTargets,
  NutrientSourcesResponse,
  StatsSummary,
  SupplementDefinition,
  SupplementDefinitionUpdateInput,
  SupplementIntakeLog,
  TodaySummary,
  UserSettings,
  WaterLogRow,
  WeekSummary,
  WeightEntry,
  WeightLogRow,
} from "@/lib/types";

/**
 * Central query-key registry. Keep every key derivation here so invalidations
 * elsewhere (mutations) can reference the same shape instead of hand-rolling
 * arrays that might drift out of sync.
 */
export const queryKeys = {
  today: (date?: string) => ["summary", "today", date ?? null] as const,
  weekly: (mode: "last7" | "week", offset: number) => ["summary", "weekly", mode, offset] as const,
  stats: (days: number) => ["stats", days] as const,
  weightLogs: (days: number) => ["weight-logs", days] as const,
  foodsSearch: (q: string, page: number, limit: number) => ["foods", "search", q, page, limit] as const,
  foodDetail: (id: string | null) => ["foods", "detail", id] as const,
  nutrientSources: (nutrient: string | null, from: string, to: string) =>
    ["nutrient-sources", nutrient, from, to] as const,
  settings: () => ["settings"] as const,
  integrations: () => ["integrations"] as const,

  // --- CRUD-oriented, id-bearing lists (Phase 5) ---
  // Prefix-only variants (e.g. foodLogDayAll) are for broad invalidation after
  // a mutation that may move an entry to a different date.
  foodLogDayAll: () => ["food-log-day"] as const,
  foodLogDay: (date: string) => ["food-log-day", date] as const,
  weightLogListAll: () => ["weight-log-list"] as const,
  weightLogList: (from?: string, to?: string, source?: string) =>
    ["weight-log-list", from ?? null, to ?? null, source ?? null] as const,
  waterLogDayAll: () => ["water-log-day"] as const,
  waterLogDay: (date: string) => ["water-log-day", date] as const,
  supplementLogDayAll: () => ["supplement-log-day"] as const,
  supplementLogDay: (date: string) => ["supplement-log-day", date] as const,
  todayAll: () => ["summary", "today"] as const,
  weeklyAll: () => ["summary", "weekly"] as const,
  statsAll: () => ["stats"] as const,
};

/* ─────────────────────────── Dashboard summaries ─────────────────────────── */

export function useTodaySummary(dateStr?: string) {
  return useQuery({
    queryKey: queryKeys.today(dateStr),
    queryFn: () => {
      const url = dateStr ? `/api/dashboard/today?date=${dateStr}` : "/api/dashboard/today";
      return apiFetch<TodaySummary>(url);
    },
  });
}

export function useWeekSummary(mode: "last7" | "week" = "last7", offset: number = 0) {
  return useQuery({
    queryKey: queryKeys.weekly(mode, offset),
    queryFn: () => apiFetch<WeekSummary>(`/api/dashboard/weekly?mode=${mode}&offset=${offset}`),
  });
}

export function useStats(days: number) {
  return useQuery({
    queryKey: queryKeys.stats(days),
    queryFn: () => apiFetch<StatsSummary>(`/api/dashboard/stats?days=${days}`),
  });
}

export function useWeightLogs(days: number = 90) {
  return useQuery({
    queryKey: queryKeys.weightLogs(days),
    queryFn: () => apiFetch<WeightEntry[]>(`/api/dashboard/weight?days=${days}`),
  });
}

/** Full food-log detail (with log ids) for a single day — powers edit/delete in the meals list. */
export function useFoodLogDay(date: string) {
  return useQuery({
    queryKey: queryKeys.foodLogDay(date),
    queryFn: () => apiFetch<DailyFoodLogResponse>(`/api/agent/log/food?day=${date}`),
  });
}

/** Weight/body-comp rows with ids — powers the Body page "Measurements" list. */
export function useWeightLogList(from?: string, to?: string, source?: string) {
  return useQuery({
    queryKey: queryKeys.weightLogList(from, to, source),
    queryFn: () => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (source) params.set("source", source);
      const qs = params.toString();
      return apiFetch<WeightLogRow[]>(`/api/agent/log/weight${qs ? `?${qs}` : ""}`);
    },
  });
}

/** Water log rows (with ids) for a single day — powers quick-add entries list on Today. */
export function useWaterLogDay(date: string) {
  return useQuery({
    queryKey: queryKeys.waterLogDay(date),
    queryFn: () => apiFetch<WaterLogRow[]>(`/api/agent/log/water?day=${date}`),
  });
}

/** Supplement intake log rows (with ids) for a single day — powers the actionable checklist. */
export function useSupplementLogDay(date: string) {
  return useQuery({
    queryKey: queryKeys.supplementLogDay(date),
    queryFn: () => apiFetch<SupplementIntakeLog[]>(`/api/agent/log/supplement?day=${date}`),
  });
}

/* ────────────────────────────────── Foods ─────────────────────────────────── */

export function useFoodsSearch(query: string, page: number, limit: number = 20) {
  return useQuery({
    queryKey: queryKeys.foodsSearch(query, page, limit),
    queryFn: () =>
      apiFetch<FoodsSearchPage>(`/api/dashboard/foods?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`),
  });
}

export function useFoodDetail(id: string | null) {
  return useQuery({
    queryKey: queryKeys.foodDetail(id),
    queryFn: () => apiFetch<FoodDetail>(`/api/dashboard/foods/${id}`),
    enabled: !!id,
  });
}

/** Barcode lookup is user-triggered (scan / manual submit), so it's a mutation rather than a query. */
export function useBarcodeLookup() {
  return useMutation({
    mutationFn: (code: string) => apiFetch<FoodDetail>(`/api/foods/barcode/${code}`),
    // The scanner page renders its own rich not-found/network error states, so
    // it opts out of the global error toast to avoid double-surfacing errors.
    meta: { suppressErrorToast: true },
  });
}

/* ───────────────────────── Nutrient source drill-downs ────────────────────── */

export function useNutrientSources(nutrient: string | null, from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.nutrientSources(nutrient, from, to),
    queryFn: () => apiFetch<NutrientSourcesResponse>(`/api/dashboard/nutrient-sources?nutrient=${nutrient}&from=${from}&to=${to}`),
    enabled: !!nutrient,
  });
}

/* ─────────────────────────────── Settings ─────────────────────────────────── */

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings(),
    queryFn: () => apiFetch<UserSettings>("/api/v1/settings"),
  });
}

export function useIntegrations() {
  return useQuery({
    queryKey: queryKeys.integrations(),
    queryFn: () => apiFetch<Integration[]>("/api/v1/integrations"),
  });
}

export function useUpdateNutritionTargets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targets: NutritionTargets) =>
      apiFetch<NutritionTargets>("/api/v1/settings/nutrition-targets", {
        method: "PUT",
        body: JSON.stringify(targets),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings() });
    },
  });
}

export function useUpdateMicronutrientTargets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targets: MicronutrientTargetItem[]) =>
      apiFetch<MicronutrientTargetItem[]>("/api/v1/settings/micronutrient-targets", {
        method: "PUT",
        body: JSON.stringify({ targets }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings() });
    },
  });
}

export interface CreateSupplementInput {
  name: string;
  dose_amount: number;
  dose_unit: string;
  time_of_day: string | null;
  micronutrients: Record<string, number> | null;
}

export function useCreateSupplement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSupplementInput) =>
      apiFetch<SupplementDefinition>("/api/v1/supplements", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings() });
    },
  });
}

/**
 * Update a supplement definition. Accepts any subset of fields (name, dose,
 * unit, timing, active, micronutrients) so it covers both the quick
 * active/inactive toggle and the full edit form.
 */
export function useUpdateSupplement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & SupplementDefinitionUpdateInput) =>
      apiFetch<SupplementDefinition>(`/api/v1/supplements/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings() });
    },
  });
}

export function useDeleteSupplement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/v1/supplements/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings() });
    },
  });
}

export function useRegenerateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ api_key_masked: string; api_key: string }>("/api/v1/settings/regenerate-api-key", {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings() });
    },
  });
}
