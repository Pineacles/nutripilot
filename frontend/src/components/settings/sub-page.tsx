"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ErrorState } from "@/components/ui/error-state";
import { useSettings } from "@/hooks/queries";
import { getErrorMessage } from "@/lib/api";
import type { UserSettings } from "@/lib/types";

/**
 * One settings section as its own page: a 44px back chevron to the index, the section title, then
 * the content once settings have loaded. The layout's own heading stays for screen readers.
 */
export function SettingsSubPage({ title, children }: { title: string; children: (settings: UserSettings) => React.ReactNode }) {
  const { data: settings, isError, error, refetch } = useSettings();

  return (
    <DashboardLayout title={title} hideTitle>
      <div className="max-w-2xl">
        <header className="-mt-2 mb-4 flex items-center gap-1">
          <Link
            href="/settings"
            aria-label="Back to settings"
            className="-ml-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-g5 transition-colors duration-[var(--dur-fast)] hover:bg-g2 hover:text-ink"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
          </Link>
          <p aria-hidden="true" className="text-[22px] leading-tight font-semibold tracking-[-0.01em] text-ink">{title}</p>
        </header>
        {settings ? (
          children(settings)
        ) : isError ? (
          <ErrorState message={getErrorMessage(error, "Couldn't load settings.")} onRetry={() => refetch()} />
        ) : (
          <div aria-busy="true">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex h-[60px] items-center border-t border-g2">
                <div className="h-4 w-32 rounded bg-g2 animate-pulse motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
