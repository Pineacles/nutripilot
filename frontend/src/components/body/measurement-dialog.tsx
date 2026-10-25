"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDeleteWeightLog, useLogWeight, useUpdateWeightLog } from "@/hooks/mutations/weight";
import { WEIGHT_LOG_BOUNDS, validateBounds } from "@/lib/validation";
import { todayStr } from "@/lib/dates";
import { fmtDateFull } from "@/lib/chart-utils";
import type { WeightLogRow } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present in edit mode; null/undefined means "create a new measurement". */
  entry?: WeightLogRow | null;
  defaultDate?: string;
}

const field = "h-12 rounded-[14px] border-g3 px-3.5 text-base tabular-nums focus-visible:border-ink focus-visible:ring-0 aria-invalid:border-ink aria-invalid:ring-0";
const label = "text-[12px] font-normal text-g4";

/** Simple weight/body-fat/muscle-mass measurement: create or edit, per the Body page spec. */
export function MeasurementDialog({ open, onOpenChange, entry, defaultDate }: Props) {
  const isEdit = !!entry;
  const canEditDate = !isEdit || entry?.source === "manual";

  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPct, setBodyFatPct] = useState("");
  const [muscleMassPct, setMuscleMassPct] = useState("");
  const [date, setDate] = useState(defaultDate ?? todayStr());

  const logWeight = useLogWeight();
  const updateWeight = useUpdateWeightLog();
  const deleteWeight = useDeleteWeightLog();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pending = logWeight.isPending || updateWeight.isPending || deleteWeight.isPending;

  useEffect(() => {
    if (!open) return;
    // Deferred to a microtask so this isn't a synchronous setState call at the effect
    // top level (avoids react-hooks/set-state-in-effect).
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setConfirmDelete(false);
      setWeightKg(entry?.weight_kg != null ? String(entry.weight_kg) : "");
      setBodyFatPct(entry?.body_fat_pct != null ? String(entry.body_fat_pct) : "");
      setMuscleMassPct(entry?.muscle_mass_pct != null ? String(entry.muscle_mass_pct) : "");
      setDate(entry?.date ?? defaultDate ?? todayStr());
    });
    return () => {
      cancelled = true;
    };
  }, [open, entry, defaultDate]);

  const weightError = weightKg === "" ? "Required" : validateBounds(Number(weightKg), WEIGHT_LOG_BOUNDS.weight_kg);
  const bfError = bodyFatPct === "" ? null : validateBounds(Number(bodyFatPct), WEIGHT_LOG_BOUNDS.body_fat_pct);
  const muscleError = muscleMassPct === "" ? null : validateBounds(Number(muscleMassPct), WEIGHT_LOG_BOUNDS.muscle_mass_pct);
  const hasErrors = !!weightError || !!bfError || !!muscleError;

  function handleSubmit() {
    if (hasErrors) return;
    const base = {
      weight_kg: Number(weightKg),
      body_fat_pct: bodyFatPct === "" ? null : Number(bodyFatPct),
      muscle_mass_pct: muscleMassPct === "" ? null : Number(muscleMassPct),
    };
    if (isEdit && entry) {
      updateWeight.mutate(
        { id: entry.id, ...base, ...(canEditDate && date !== entry.date ? { log_date: date } : {}) },
        { onSuccess: () => { toast.success("Measurement updated"); onOpenChange(false); } }
      );
    } else {
      logWeight.mutate(
        { ...base, date },
        { onSuccess: () => { toast.success("Measurement logged"); onOpenChange(false); } }
      );
    }
  }

  function handleDelete() {
    if (!entry) return;
    deleteWeight.mutate(entry.id, {
      onSuccess: () => { toast.success("Measurement removed"); onOpenChange(false); },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit measurement" : "Add measurement"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className={label}>Weight (kg)</Label>
            <Input
              type="number"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              aria-invalid={!!weightError}
              className={field}
              step="0.1"
            />
            {weightError && <p className="text-[12px] text-ink">{weightError}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={label}>Body fat %</Label>
              <Input
                type="number"
                value={bodyFatPct}
                onChange={(e) => setBodyFatPct(e.target.value)}
                aria-invalid={!!bfError}
                placeholder="optional"
                className={field}
                step="0.1"
              />
              {bfError && <p className="text-[12px] text-ink">{bfError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className={label}>Muscle mass %</Label>
              <Input
                type="number"
                value={muscleMassPct}
                onChange={(e) => setMuscleMassPct(e.target.value)}
                aria-invalid={!!muscleError}
                placeholder="optional"
                className={field}
                step="0.1"
              />
              {muscleError && <p className="text-[12px] text-ink">{muscleError}</p>}
            </div>
          </div>
          {canEditDate ? (
            <div className="space-y-1.5">
              <Label className={label}>Date</Label>
              <Input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} className={field} />
            </div>
          ) : (
            <p className="text-[12px] text-g4">
              Synced from {entry?.source} on {entry?.date ? fmtDateFull(entry.date) : ""}. Date can&apos;t be changed for synced entries.
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSubmit}
              disabled={hasErrors || pending}
              className="h-12 flex-1 rounded-full bg-ink text-[15px] font-medium text-g0 transition-transform active:scale-[0.98] disabled:bg-g3 disabled:text-g5"
            >
              {pending ? "Saving..." : isEdit ? "Save changes" : "Log measurement"}
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="h-12 rounded-full border border-g3 px-5 text-[13px] font-medium text-ink transition-colors hover:border-g5"
            >
              Cancel
            </button>
          </div>
          {isEdit && (
            <div className="flex items-center justify-between gap-2 border-t border-g2 pt-3">
              {confirmDelete ? (
                <>
                  <span className="text-[13px] text-g5">Delete this measurement?</span>
                  <div className="flex gap-2">
                    <button onClick={handleDelete} disabled={pending} className="h-11 rounded-full border border-g3 px-4 text-[13px] font-medium text-ink transition-colors hover:border-g5 disabled:text-g3">Delete</button>
                    <button onClick={() => setConfirmDelete(false)} className="h-11 rounded-full px-4 text-[13px] font-medium text-g5 hover:text-ink">Keep</button>
                  </div>
                </>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="h-11 text-[13px] font-medium text-g5 transition-colors hover:text-ink">Delete measurement</button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
