"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { TodaySummary, WeekSummary } from "@/lib/types";

export function useTodaySummary(dateStr?: string) {
  const [data, setData] = useState<TodaySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = dateStr ? `/api/dashboard/today?date=${dateStr}` : "/api/dashboard/today";
    apiFetch<TodaySummary>(url)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dateStr]);

  return { data, loading };
}

export function useWeekSummary(mode: "last7" | "week" = "last7", offset: number = 0) {
  const [data, setData] = useState<WeekSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<WeekSummary>(`/api/dashboard/weekly?mode=${mode}&offset=${offset}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [mode, offset]);

  return { data, loading };
}
