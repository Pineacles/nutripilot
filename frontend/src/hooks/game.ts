"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/hooks/queries";
import type { GameSettingsInput, GameState, Quest, WeekRecap } from "@/lib/game-types";

export const gameKeys = {
  all: () => ["game"] as const,
  state: () => ["game", "state"] as const,
  recap: (week: string | null) => ["game", "recap", week] as const,
};

export function useGame(enabled = true) {
  return useQuery({
    queryKey: gameKeys.state(),
    queryFn: () => apiFetch<GameState>("/api/dashboard/game"),
    enabled,
    staleTime: 30_000,
  });
}

export function useRecap(week: string | null) {
  return useQuery({
    queryKey: gameKeys.recap(week),
    queryFn: () => apiFetch<WeekRecap>(`/api/dashboard/game/recap${week ? `?week=${week}` : ""}`),
    enabled: week !== null,
  });
}

export interface SeenBody {
  prints?: { key: string; run: number | null }[];
  quests?: string[];
  freezes_through?: string | null;
  comeback_through?: string | null;
  all?: boolean;
}

export function useMarkSeen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SeenBody) =>
      apiFetch<void>("/api/dashboard/game/seen", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gameKeys.state() }),
  });
}

export function useMarkRecapSeen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (week: string) =>
      apiFetch<void>("/api/dashboard/game/recap/seen", { method: "POST", body: JSON.stringify({ week }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gameKeys.state() }),
  });
}

export function useSwapQuest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Quest>(`/api/dashboard/game/quests/${id}/swap`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gameKeys.state() }),
  });
}

export function useUpdateGameSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: GameSettingsInput) =>
      apiFetch<unknown>("/api/v1/settings/game", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.settings() });
    },
  });
}

export function useRestartStreak() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (restart_from: string | null) =>
      apiFetch<{ restart_from: string | null; previous: string | null }>("/api/dashboard/game/streak", {
        method: "PUT",
        body: JSON.stringify({ restart_from }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gameKeys.state() }),
  });
}

export function useSetDayCounts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ day, counts }: { day: string; counts: boolean }) =>
      apiFetch<void>(`/api/dashboard/game/days/${day}`, { method: "PUT", body: JSON.stringify({ counts }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gameKeys.state() }),
  });
}
