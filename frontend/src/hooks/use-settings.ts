"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { UserSettings } from "@/lib/types";

export function useSettings() {
  const [data, setData] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<UserSettings>("/api/v1/settings")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}
