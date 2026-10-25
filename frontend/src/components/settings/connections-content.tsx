"use client";

import { useState } from "react";
import { useIntegrations } from "@/hooks/queries";
import type { UserSettings } from "@/lib/types";
import { ApiKeySection, RegenerateKeySection } from "./api-key-section";
import { IntegrationsPanel } from "./integrations-panel";

/** API key, integrations, and at the bottom, set apart, Regenerate key. */
export function ConnectionsContent({ settings }: { settings: UserSettings }) {
  const { data: integrations = [] } = useIntegrations();
  const [fullApiKey, setFullApiKey] = useState<string | null>(null);
  return (
    <div className="space-y-8">
      <ApiKeySection apiKeyMasked={settings.api_key_masked ?? ""} fullApiKey={fullApiKey} />
      <IntegrationsPanel integrations={integrations} />
      <RegenerateKeySection onRegenerated={setFullApiKey} />
    </div>
  );
}
