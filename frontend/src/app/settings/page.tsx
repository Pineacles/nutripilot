"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { ErrorState } from "@/components/ui/error-state";
import { useSettings, useIntegrations } from "@/hooks/queries";
import { getErrorMessage } from "@/lib/api";
import { signOut } from "@/lib/auth";
import { NutritionTargetsForm } from "@/components/settings/nutrition-targets-form";
import { SupplementsSection } from "@/components/settings/supplements-section";
import { MicronutrientTargetsForm } from "@/components/settings/micronutrient-targets-form";
import { ApiKeySection } from "@/components/settings/api-key-section";
import { InstallCard } from "@/components/install-card";
import { IntegrationsPanel } from "@/components/settings/integrations-panel";

export default function SettingsPage() {
  const { data: settings, isLoading: loading, isError, error, refetch } = useSettings();
  const { data: integrations = [] } = useIntegrations();

  if (isError && !settings) {
    return (
      <DashboardLayout title="Settings">
        <ErrorState message={getErrorMessage(error, "Couldn't load settings.")} onRetry={() => refetch()} />
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout title="Settings">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="clay-card p-5 space-y-3">
              <div className="h-4 w-32 rounded bg-muted animate-pulse" />
              <div className="space-y-2">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-10 rounded-lg bg-muted/50 animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </DashboardLayout>
    );
  }

  const supplements = settings?.supplement_definitions ?? [];
  const apiKeyMasked = settings?.api_key_masked ?? "";

  return (
    <DashboardLayout title="Settings">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NutritionTargetsForm initial={settings?.nutrition_targets} />
        <SupplementsSection supplements={supplements} />
        <MicronutrientTargetsForm initial={settings?.micronutrient_targets} />
        <ApiKeySection apiKeyMasked={apiKeyMasked} />
        <IntegrationsPanel integrations={integrations} />
        <InstallCard className="md:col-span-2" />
        {/* The sidebar (with its Sign out) is hidden below lg, so phones get it here. */}
        <button
          onClick={signOut}
          className="clay-card flex h-12 w-full items-center gap-3 px-5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:col-span-2 lg:hidden"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          Sign out
        </button>
      </div>
    </DashboardLayout>
  );
}
