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
import { TrackedNutrientsSection } from "@/components/settings/tracked-nutrients-section";

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
        <div className="grid grid-cols-1 gap-y-0 md:grid-cols-2 md:gap-4" aria-busy="true">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="clay-card space-y-3 p-5">
              <div className="h-4 w-32 rounded bg-g2 animate-pulse motion-reduce:animate-none" />
              <div className="space-y-2">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-[60px] border-t border-g2" />
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
      <div className="grid grid-cols-1 gap-y-0 md:grid-cols-2 md:gap-4">
        <TrackedNutrientsSection />
        <NutritionTargetsForm initial={settings?.nutrition_targets} />
        <SupplementsSection supplements={supplements} />
        <MicronutrientTargetsForm initial={settings?.micronutrient_targets} />
        <ApiKeySection apiKeyMasked={apiKeyMasked} />
        <IntegrationsPanel integrations={integrations} />
        <InstallCard className="md:col-span-2" />
        {/* The sidebar (with its Sign out) is hidden below lg, so phones get it here. */}
        <button
          onClick={signOut}
          className="flex min-h-[60px] w-full items-center gap-3 border-t border-g2 text-[15px] text-g5 transition-colors duration-[var(--dur-fast)] hover:text-ink md:col-span-2 lg:hidden"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          Sign out
        </button>
      </div>
    </DashboardLayout>
  );
}
