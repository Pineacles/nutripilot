"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SettingsSection } from "./section";
import { useSyncIntegration, useUpdateIntegration, useDeleteIntegration, useReconnectIntegration } from "@/hooks/mutations/integrations";
import { AddIntegrationDialog } from "./add-integration-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { cronToHuman, timeAgo } from "@/lib/format";
import { getErrorMessage } from "@/lib/api";
import type { Integration } from "@/lib/types";

interface Props {
  integrations: Integration[];
}

// Where the Withings login sends the browser back to: /settings/connections?withings=<result>.
const RECONNECT_RESULTS: Record<string, [ok: boolean, message: string]> = {
  connected: [true, "Withings is connected again."],
  cancelled: [false, "Withings was not reconnected: access was not allowed."],
  expired: [false, "The Withings login took too long. Try Reconnect again."],
  failed: [false, "Withings did not accept the login. Try Reconnect again."],
};

function useReconnectResult() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const key = url.searchParams.get("withings") ?? "";
    if (!Object.hasOwn(RECONNECT_RESULTS, key)) return;
    const result = RECONNECT_RESULTS[key];
    const [ok, message] = result;
    if (ok) toast.success(message);
    else toast.error(message);
    url.searchParams.delete("withings");
    window.history.replaceState(null, "", url.pathname + url.search);
  }, []);
}

function IntegrationRow({ integration }: { integration: Integration }) {
  const syncIntegration = useSyncIntegration();
  const updateIntegration = useUpdateIntegration();
  const deleteIntegration = useDeleteIntegration();
  const reconnect = useReconnectIntegration();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isPaused = integration.status === "paused";
  const isWithings = integration.field_mapping?.type === "withings_measure";
  const needsLogin = integration.status === "needs_reauth";

  function handleSync() {
    syncIntegration.mutate(integration.id, {
      onSuccess: (res) => toast.success(`Synced ${res.entries_synced} entr${res.entries_synced === 1 ? "y" : "ies"}`),
      onError: (err) => toast.error(getErrorMessage(err, "Sync failed.")),
    });
  }

  function handleToggle() {
    updateIntegration.mutate(
      { id: integration.id, status: isPaused ? "active" : "paused" },
      { onSuccess: () => toast.success(isPaused ? "Integration enabled" : "Integration paused") }
    );
  }

  function handleReconnect() {
    reconnect.mutate(integration.id, {
      onSuccess: ({ url }) => window.location.assign(url),
      onError: (err) => toast.error(getErrorMessage(err, "Could not start the Withings login.")),
    });
  }

  function handleDelete() {
    deleteIntegration.mutate(integration.id, {
      onSuccess: () => toast.success("Integration removed"),
    });
  }

  return (
    <div className="space-y-3 border-t border-g2 py-4">
      <div className="min-w-0">
        <p className="truncate text-[17px] font-medium text-ink">{integration.name}</p>
        <p className="truncate text-xs text-g4">{integration.source_url}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Badge variant={integration.status === "active" ? "default" : integration.status === "paused" ? "secondary" : "destructive"}>
            {needsLogin ? "login needed" : integration.status}
          </Badge>
          <span className="text-xs text-g4">{cronToHuman(integration.schedule)}</span>
          <span className="text-xs text-g4">Synced: {timeAgo(integration.last_synced_at)}</span>
        </div>
        {needsLogin && (
          <p className="mt-2 text-[15px] text-ink">
            {isWithings ? "Withings stopped accepting the saved login. Reconnect to sync again." : "This connection needs a new login."}
          </p>
        )}
      </div>
      {confirmingDelete ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-1 text-[15px] text-ink">Remove this integration?</p>
          <Button size="sm" onClick={handleDelete} disabled={deleteIntegration.isPending}>Delete</Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)}>Cancel</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {isWithings && (
            <Button size="sm" variant={needsLogin ? "default" : "ghost"} onClick={handleReconnect} disabled={reconnect.isPending}>
              {reconnect.isPending ? "Opening Withings..." : "Reconnect"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleSync} disabled={syncIntegration.isPending || needsLogin}>
            {syncIntegration.isPending ? "Syncing..." : "Sync now"}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleToggle} disabled={updateIntegration.isPending}>
            {isPaused ? "Enable" : "Disable"}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setConfirmingDelete(true)}>Delete</Button>
        </div>
      )}
    </div>
  );
}

export function IntegrationsPanel({ integrations }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  useReconnectResult();

  return (
    <SettingsSection
      title="Integrations"
      action={integrations.length > 0 ? <Button onClick={() => setAddOpen(true)} size="sm" variant="outline">Add integration</Button> : undefined}
    >
      {integrations.length === 0 ? (
        <EmptyState message="No integrations connected yet." actionLabel="Add integration" onAction={() => setAddOpen(true)} />
      ) : (
        <div>
          {integrations.map((integration) => (
            <IntegrationRow key={integration.id} integration={integration} />
          ))}
        </div>
      )}
      <AddIntegrationDialog open={addOpen} onOpenChange={setAddOpen} />
    </SettingsSection>
  );
}
