"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ErrorState } from "@/components/ui/error-state";
import { useIntegrations, useSettings } from "@/hooks/queries";
import { getErrorMessage } from "@/lib/api";
import { nutritionTargetsOf } from "@/components/settings/autosave";
import type { UserSettings } from "@/lib/types";

function nutrientsSummary(s: UserSettings): string {
  return `${nutritionTargetsOf(s).target_kcal} kcal`;
}

function goalsSummary(s: UserSettings): string {
  const t = nutritionTargetsOf(s);
  if (t.target_weight_kg != null) return `${t.target_weight_kg} kg`;
  if (t.target_body_fat_pct != null) return `${t.target_body_fat_pct} % body fat`;
  return "No goal";
}

function supplementsSummary(s: UserSettings): string {
  const n = (s.supplement_definitions ?? []).filter((d) => d.active).length;
  return n === 0 ? "None" : `${n} daily`;
}

export default function SettingsPage() {
  const { data: settings, isError, error, refetch } = useSettings();
  const { data: integrations } = useIntegrations();

  if (isError && !settings) {
    return (
      <DashboardLayout title="Settings">
        <ErrorState message={getErrorMessage(error, "Couldn't load settings.")} onRetry={() => refetch()} />
      </DashboardLayout>
    );
  }

  const count = integrations?.length;
  const rows: { href: string; name: string; value: string | null }[] = [
    { href: "/settings/nutrients", name: "Nutrients and targets", value: settings ? nutrientsSummary(settings) : null },
    { href: "/settings/goals", name: "Goals", value: settings ? goalsSummary(settings) : null },
    { href: "/settings/supplements", name: "Supplements", value: settings ? supplementsSummary(settings) : null },
    {
      href: "/settings/connections",
      name: "Connections",
      value: count === undefined ? null : `API key, ${count} integration${count === 1 ? "" : "s"}`,
    },
    { href: "/settings/app", name: "App", value: "" },
  ];

  return (
    <DashboardLayout title="Settings">
      <nav aria-label="Settings sections" className="max-w-2xl border-b border-g2">
        <ul>
          {rows.map((r) => (
            <li key={r.href} className="border-t border-g2">
              <Link
                href={r.href}
                className="flex min-h-[60px] items-center gap-3 transition-colors duration-[var(--dur-fast)] hover:bg-g1"
              >
                <span className="min-w-0 flex-1 truncate text-[17px] font-medium text-ink">{r.name}</span>
                {r.value === null ? (
                  <span aria-hidden="true" className="h-3.5 w-24 rounded bg-g2 animate-pulse motion-reduce:animate-none" />
                ) : (
                  <span className="min-w-0 max-w-[55%] truncate text-[15px] text-g5 tabular-nums">{r.value}</span>
                )}
                <ChevronRight className="h-5 w-5 shrink-0 text-g4" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </DashboardLayout>
  );
}
