"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { ErrorState } from "@/components/ui/error-state";
import { useSettings, useIntegrations } from "@/hooks/queries";
import { getErrorMessage } from "@/lib/api";
import { NutritionTargetsForm } from "@/components/settings/nutrition-targets-form";
import { SupplementsSection } from "@/components/settings/supplements-section";
import { MicronutrientTargetsForm } from "@/components/settings/micronutrient-targets-form";
import { ApiKeySection } from "@/components/settings/api-key-section";
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
      </div>
    </DashboardLayout>
  );
}
