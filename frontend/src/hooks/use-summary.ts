"use client";

import { useEffect, useReducer } from "react";
import { apiFetch } from "@/lib/api";
import type { TodaySummary, WeekSummary } from "@/lib/types";

type FetchState<T> = { data: T | null; loading: boolean };
type FetchAction<T> = { type: "resolved"; data: T } | { type: "rejected" };

function fetchReducer<T>(state: FetchState<T>, action: FetchAction<T>): FetchState<T> {
  if (action.type === "resolved") return { data: action.data, loading: false };
  if (action.type === "rejected") return { ...state, loading: false };
  return state;
}

export function useTodaySummary(dateStr?: string) {
  const [state, dispatch] = useReducer(
    fetchReducer<TodaySummary>,
    { data: null, loading: true },
  );

  useEffect(() => {
    // Dispatch happens inside async callbacks — never synchronously at the effect top level
    // (avoids react-hooks/set-state-in-effect cascading render warning).
    let cancelled = false;
    const url = dateStr ? `/api/dashboard/today?date=${dateStr}` : "/api/dashboard/today";
    apiFetch<TodaySummary>(url)
      .then((d) => { if (!cancelled) dispatch({ type: "resolved", data: d }); })
      .catch(() => { if (!cancelled) dispatch({ type: "rejected" }); });
    return () => { cancelled = true; };
  }, [dateStr]);

  return { data: state.data, loading: state.loading };
}

export function useWeekSummary(mode: "last7" | "week" = "last7", offset: number = 0) {
  const [state, dispatch] = useReducer(
    fetchReducer<WeekSummary>,
    { data: null, loading: true },
  );

  useEffect(() => {
    let cancelled = false;
    apiFetch<WeekSummary>(`/api/dashboard/weekly?mode=${mode}&offset=${offset}`)
      .then((d) => { if (!cancelled) dispatch({ type: "resolved", data: d }); })
      .catch(() => { if (!cancelled) dispatch({ type: "rejected" }); });
    return () => { cancelled = true; };
  }, [mode, offset]);

  return { data: state.data, loading: state.loading };
}
