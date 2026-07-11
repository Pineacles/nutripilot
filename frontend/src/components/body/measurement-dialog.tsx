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
import { Button } from "@/components/ui/button";
import { useLogWeight, useUpdateWeightLog } from "@/hooks/mutations/weight";
import { WEIGHT_LOG_BOUNDS, validateBounds } from "@/lib/validation";
import { todayStr } from "@/lib/dates";
import type { WeightLogRow } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present in edit mode; null/undefined means "create a new measurement". */
  entry?: WeightLogRow | null;
  defaultDate?: string;
}

/** Simple weight/body-fat/muscle-mass measurement — create or edit, per the Body page spec. */
export function MeasurementDialog({ open, onOpenChange, entry, defaultDate }: Props) {
  const isEdit = !!entry;
  const canEditDate = !isEdit || entry?.source === "manual";

  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPct, setBodyFatPct] = useState("");
  const [muscleMassPct, setMuscleMassPct] = useState("");
  const [date, setDate] = useState(defaultDate ?? todayStr());

  const logWeight = useLogWeight();
  const updateWeight = useUpdateWeightLog();
  const pending = logWeight.isPending || updateWeight.isPending;

  useEffect(() => {
    if (!open) return;
    // Deferred to a microtask so this isn't a synchronous setState call at the effect
    // top level (avoids react-hooks/set-state-in-effect).
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit measurement" : "Add measurement"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Weight (kg)</Label>
            <Input
              type="number"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              aria-invalid={!!weightError}
              className="tabular-nums"
              step="0.1"
            />
            {weightError && <p className="text-[11px] text-destructive">{weightError}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Body fat %</Label>
              <Input
                type="number"
                value={bodyFatPct}
                onChange={(e) => setBodyFatPct(e.target.value)}
                aria-invalid={!!bfError}
                placeholder="optional"
                className="tabular-nums"
                step="0.1"
              />
              {bfError && <p className="text-[11px] text-destructive">{bfError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Muscle mass %</Label>
              <Input
                type="number"
                value={muscleMassPct}
                onChange={(e) => setMuscleMassPct(e.target.value)}
                aria-invalid={!!muscleError}
                placeholder="optional"
                className="tabular-nums"
                step="0.1"
              />
              {muscleError && <p className="text-[11px] text-destructive">{muscleError}</p>}
            </div>
          </div>
          {canEditDate ? (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} className="tabular-nums" />
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Synced from {entry?.source} on {entry?.date} — date can&apos;t be changed for synced entries.
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <Button onClick={handleSubmit} disabled={hasErrors || pending} size="lg" className="flex-1">
              {pending ? "Saving..." : isEdit ? "Save changes" : "Log measurement"}
            </Button>
            <Button onClick={() => onOpenChange(false)} variant="outline" size="lg">Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
