"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSyncIntegration, useUpdateIntegration, useDeleteIntegration } from "@/hooks/mutations/integrations";
import { AddIntegrationDialog } from "./add-integration-dialog";
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
    <div className="pill rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{integration.name}</p>
        <p className="text-xs text-muted-foreground truncate">{integration.source_url}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-muted-foreground">{cronToHuman(integration.schedule)}</span>
          <Badge variant={integration.status === "active" ? "default" : integration.status === "paused" ? "secondary" : "destructive"} className="text-[10px]">
            {integration.status}
          </Badge>
          <span className="text-[10px] text-muted-foreground">Synced: {timeAgo(integration.last_synced_at)}</span>
        </div>
      </div>
      {confirmingDelete ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="xs" variant="destructive" onClick={handleDelete} disabled={deleteIntegration.isPending}>Confirm</Button>
          <Button size="xs" variant="ghost" onClick={() => setConfirmingDelete(false)}>Cancel</Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="xs" variant="outline" onClick={handleSync} disabled={syncIntegration.isPending}>
            {syncIntegration.isPending ? "Syncing..." : "Sync now"}
          </Button>
          <Button size="xs" variant="ghost" onClick={handleToggle} disabled={updateIntegration.isPending}>
            {isPaused ? "Enable" : "Disable"}
          </Button>
          <Button size="xs" variant="destructive" onClick={() => setConfirmingDelete(true)}>Delete</Button>
        </div>
      )}
    </div>
  );
}

export function IntegrationsPanel({ integrations }: Props) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="clay-card p-5 md:col-span-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Connected Integrations</h3>
        <Button onClick={() => setAddOpen(true)} size="sm">+ Add integration</Button>
      </div>
      {integrations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No integrations connected yet.</p>
      ) : (
        <div className="space-y-2">
          {integrations.map((integration) => (
            <IntegrationRow key={integration.id} integration={integration} />
          ))}
        </div>
      )}
      <AddIntegrationDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
