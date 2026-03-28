"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { TodaySummary, WeekSummary } from "@/lib/types";

export function useTodaySummary() {
  const [data, setData] = useState<TodaySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<TodaySummary>("/api/dashboard/today")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}

export function useWeekSummary() {
  const [data, setData] = useState<WeekSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<WeekSummary>("/api/dashboard/weekly")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}
