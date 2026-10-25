"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Band } from "./band";
import { useWeightLogList } from "@/hooks/queries";
import { useDeleteWeightLog } from "@/hooks/mutations/weight";
import { MeasurementDialog } from "./measurement-dialog";
import { getErrorMessage } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { fmtDate } from "@/lib/chart-utils";
import type { WeightLogRow } from "@/lib/types";

const SHOWN = 5;
const PAGE = 20;
const iconBtn =
  "flex h-11 w-11 items-center justify-center rounded-full text-g4 transition-colors hover:bg-g2 hover:text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const pillBtn =
  "h-11 rounded-full border border-g3 px-4 text-[13px] font-medium text-ink transition-colors hover:border-g5 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:text-g3";

export function MeasurementsList({ onAdd, addOpen, onAddOpenChange }: {
  /** The page owns the Add dialog so its top row can open it too. */
  onAdd: () => void;
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
}) {
  const { data = [], isLoading, isError, error, refetch } = useWeightLogList();
  const deleteLog = useDeleteWeightLog();

  const [editEntry, setEditEntry] = useState<WeightLogRow | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [shown, setShown] = useState(SHOWN);

  const recent = useMemo(() => [...data].reverse(), [data]);
  const rows = recent.slice(0, shown);
  const remaining = recent.length - rows.length;

  function handleDelete(id: string) {
    deleteLog.mutate(id, {
      onSuccess: () => { toast.success("Measurement removed"); setConfirmDeleteId(null); },
    });
  }

  return (
    <Band title="Measurements" aside={recent.length > 0 ? `${data.length} logged` : undefined}>
      {isError ? (
        <p className="py-4 text-[15px] text-ink">
          {getErrorMessage(error, "Couldn't load measurements.")}{" "}
          <button onClick={() => refetch()} className="underline underline-offset-4">Try again</button>
        </p>
      ) : isLoading ? (
        <div className="space-y-px" aria-busy="true" aria-label="Loading measurements">
          {[1, 2, 3].map((i) => <div key={i} className="h-[60px] animate-pulse bg-g1" />)}
        </div>
      ) : recent.length === 0 ? (
        <div className="border-y border-g2 py-8">
          <p className="text-[15px] text-g4">Nothing logged yet. Weigh in and add it to start your trend.</p>
          <button onClick={onAdd} className="mt-4 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-medium text-g0 transition-transform active:scale-[0.98]">
            <Plus className="h-4 w-4" aria-hidden="true" /> Add measurement
          </button>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-g2 border-y border-g2">
            {rows.map((entry) => (
              <li key={entry.id} className="flex min-h-[60px] items-center gap-2">
                <div className="min-w-0 flex-1 py-2">
                  <p className="text-[17px] font-medium tabular-nums text-ink">{fmt(entry.weight_kg)} kg</p>
                  <p className="truncate text-[12px] tabular-nums text-g4">
                    {fmtDate(entry.date)}
                    {entry.body_fat_pct != null && ` · ${fmt(entry.body_fat_pct)}% fat`}
                    {entry.muscle_mass_pct != null && ` · ${fmt(entry.muscle_mass_pct)}% muscle`}
                    {entry.source !== "manual" && ` · ${entry.source}`}
                  </p>
                </div>
                {confirmDeleteId === entry.id ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <button className={pillBtn} onClick={() => handleDelete(entry.id)} disabled={deleteLog.isPending}>Delete</button>
                    <button className={`${pillBtn} border-transparent text-g5`} onClick={() => setConfirmDeleteId(null)}>Keep</button>
                  </div>
                ) : (
                  <div className="flex shrink-0 items-center">
                    <button onClick={() => setEditEntry(entry)} className={iconBtn} aria-label={`Edit ${fmtDate(entry.date)}`}><Pencil className="h-[18px] w-[18px]" /></button>
                    <button onClick={() => setConfirmDeleteId(entry.id)} className={iconBtn} aria-label={`Delete ${fmtDate(entry.date)}`}><Trash2 className="h-[18px] w-[18px]" /></button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {recent.length > SHOWN && (
            <div className="mt-3 flex items-center gap-4">
              {remaining > 0 && (
                <button onClick={() => setShown((n) => n + PAGE)} className="h-11 text-[13px] font-medium text-g5 hover:text-ink">
                  Show {Math.min(PAGE, remaining)} more
                </button>
              )}
              {shown > SHOWN && (
                <button onClick={() => setShown(SHOWN)} className="h-11 text-[13px] font-medium text-g5 hover:text-ink">Show fewer</button>
              )}
            </div>
          )}
        </>
      )}

      <MeasurementDialog open={addOpen} onOpenChange={onAddOpenChange} />
      <MeasurementDialog open={!!editEntry} onOpenChange={(next) => !next && setEditEntry(null)} entry={editEntry} />
    </Band>
  );
}
