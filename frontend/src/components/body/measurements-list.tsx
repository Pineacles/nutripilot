"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWeightLogList } from "@/hooks/queries";
import { useDeleteWeightLog } from "@/hooks/mutations/weight";
import { MeasurementDialog } from "./measurement-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { getErrorMessage } from "@/lib/api";
import { fmt } from "@/lib/utils";
import type { WeightLogRow } from "@/lib/types";

export function MeasurementsList() {
  const { data = [], isLoading, isError, error, refetch } = useWeightLogList();
  const deleteLog = useDeleteWeightLog();

  const [addOpen, setAddOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<WeightLogRow | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const recent = useMemo(() => [...data].reverse().slice(0, 20), [data]);

  function handleDelete(id: string) {
    deleteLog.mutate(id, {
      onSuccess: () => { toast.success("Measurement removed"); setConfirmDeleteId(null); },
    });
  }

  return (
    <div className="clay-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Measurements</h3>
        <Button onClick={() => setAddOpen(true)} size="sm">+ Add measurement</Button>
      </div>

      {isError ? (
        <p className="text-sm text-destructive">
          {getErrorMessage(error, "Couldn't load measurements.")}{" "}
          <button onClick={() => refetch()} className="underline">Retry</button>
        </p>
      ) : isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />)}
        </div>
      ) : recent.length === 0 ? (
        <EmptyState message="No measurements logged yet" actionLabel="+ Add measurement" onAction={() => setAddOpen(true)} />
      ) : (
        <div className="space-y-1 max-h-[360px] overflow-y-auto thin-scrollbar">
          {recent.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 rounded-xl bg-muted/30 border border-border px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground/90 tabular-nums">{fmt(entry.weight_kg)} kg</span>
                  {entry.body_fat_pct != null && <span className="text-xs text-muted-foreground tabular-nums">{fmt(entry.body_fat_pct)}% fat</span>}
                  {entry.muscle_mass_pct != null && <span className="text-xs text-muted-foreground tabular-nums">{fmt(entry.muscle_mass_pct)}% muscle</span>}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{entry.date}</span>
                  {entry.source !== "manual" && (
                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{entry.source}</Badge>
                  )}
                </div>
              </div>
              {confirmDeleteId === entry.id ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="xs" variant="destructive" onClick={() => handleDelete(entry.id)} disabled={deleteLog.isPending}>
                    Confirm
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                </div>
              ) : (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setEditEntry(entry)} className="text-xs text-muted-foreground hover:text-foreground px-1.5">Edit</button>
                  <button onClick={() => setConfirmDeleteId(entry.id)} className="text-xs text-muted-foreground hover:text-destructive px-1.5">Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <MeasurementDialog open={addOpen} onOpenChange={setAddOpen} />
      <MeasurementDialog open={!!editEntry} onOpenChange={(next) => !next && setEditEntry(null)} entry={editEntry} />
    </div>
  );
}
