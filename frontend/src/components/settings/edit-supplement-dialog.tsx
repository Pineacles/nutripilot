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
import { useUpdateSupplement } from "@/hooks/queries";
import { DOSE_UNITS, TIMINGS } from "@/lib/supplement-constants";
import { getErrorMessage } from "@/lib/api";
import type { SupplementDefinition } from "@/lib/types";

interface Props {
  supplement: SupplementDefinition | null;
  onClose: () => void;
}

/** Full edit form for a supplement definition — mirrors the "+ Add Supplement" create form. */
export function EditSupplementDialog({ supplement, onClose }: Props) {
  const [name, setName] = useState("");
  const [doseAmount, setDoseAmount] = useState(0);
  const [doseUnit, setDoseUnit] = useState("mg");
  const [timeOfDay, setTimeOfDay] = useState("morning");
  const [micronutrients, setMicronutrients] = useState("");

  const updateSupplement = useUpdateSupplement();

  useEffect(() => {
    if (!supplement) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setName(supplement.name);
      setDoseAmount(supplement.dose_amount);
      setDoseUnit(supplement.dose_unit);
      setTimeOfDay(supplement.time_of_day ?? "morning");
      setMicronutrients(supplement.micronutrients ? JSON.stringify(supplement.micronutrients) : "");
    });
    return () => {
      cancelled = true;
    };
  }, [supplement]);

  function handleSave() {
    if (!supplement) return;
    let microObj: Record<string, number> | null = null;
    if (micronutrients.trim()) {
      try {
        microObj = JSON.parse(micronutrients);
      } catch {
        toast.error('Micronutrients must be valid JSON, e.g. {"vitamin_d": 50}');
        return;
      }
    }
    updateSupplement.mutate(
      {
        id: supplement.id,
        name,
        dose_amount: doseAmount,
        dose_unit: doseUnit,
        time_of_day: timeOfDay,
        micronutrients: microObj,
      },
      {
        onSuccess: () => { toast.success("Supplement updated"); onClose(); },
        onError: (err) => toast.error(getErrorMessage(err, "Couldn't update supplement.")),
      }
    );
  }

  return (
    <Dialog open={!!supplement} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Supplement</DialogTitle>
        </DialogHeader>
        {supplement && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Dose</Label>
                <Input
                  type="number"
                  value={doseAmount}
                  onChange={(e) => setDoseAmount(Number(e.target.value))}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Unit</Label>
                <select
                  value={doseUnit}
                  onChange={(e) => setDoseUnit(e.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  {DOSE_UNITS.map((u) => (
                    <option key={u} value={u} className="bg-card">{u}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Timing</Label>
              <select
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {TIMINGS.map((t) => (
                  <option key={t} value={t} className="bg-card">{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Micronutrients contributed (JSON, optional)</Label>
              <Input
                type="text"
                value={micronutrients}
                onChange={(e) => setMicronutrients(e.target.value)}
                placeholder='{"vitamin_d": 50, "zinc": 10}'
                className="text-xs font-mono"
              />
            </div>
            <div className="flex gap-3 mt-2">
              <Button onClick={handleSave} disabled={!name || updateSupplement.isPending} className="flex-1" size="lg">
                {updateSupplement.isPending ? "Saving..." : "Save"}
              </Button>
              <Button onClick={onClose} variant="outline" className="flex-1" size="lg">Cancel</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
