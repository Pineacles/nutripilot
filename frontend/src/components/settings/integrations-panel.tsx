"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SettingsSection } from "./section";
import { useSyncIntegration, useUpdateIntegration, useDeleteIntegration } from "@/hooks/mutations/integrations";
import { AddIntegrationDialog } from "./add-integration-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { cronToHuman, timeAgo } from "@/lib/format";
import { getErrorMessage } from "@/lib/api";
import type { Integration } from "@/lib/types";

interface Props {
  integrations: Integration[];
}

function IntegrationRow({ integration }: { integration: Integration }) {
  const syncIntegration = useSyncIntegration();
  const updateIntegration = useUpdateIntegration();
  const deleteIntegration = useDeleteIntegration();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isPaused = integration.status === "paused";

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
            {integration.status}
          </Badge>
          <span className="text-xs text-g4">{cronToHuman(integration.schedule)}</span>
          <span className="text-xs text-g4">Synced: {timeAgo(integration.last_synced_at)}</span>
        </div>
      </div>
      {confirmingDelete ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-1 text-[15px] text-ink">Remove this integration?</p>
          <Button size="sm" onClick={handleDelete} disabled={deleteIntegration.isPending}>Delete</Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)}>Cancel</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleSync} disabled={syncIntegration.isPending}>
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

  return (
    <SettingsSection
      title="Connected integrations"
      className="md:col-span-2"
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
