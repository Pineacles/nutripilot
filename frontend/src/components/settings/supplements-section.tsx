"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { SettingsSection } from "./section";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCreateSupplement,
  useUpdateSupplement,
  useDeleteSupplement,
} from "@/hooks/queries";
import { DOSE_UNITS, TIMINGS } from "@/lib/supplement-constants";
import { EditSupplementDialog } from "@/components/settings/edit-supplement-dialog";
import type { SupplementDefinition } from "@/lib/types";

interface Props {
  supplements: SupplementDefinition[];
}

export function SupplementsSection({ supplements }: Props) {
  // The row that was just added or changed flashes once.
  const [litId, setLitId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupp, setEditingSupp] = useState<SupplementDefinition | null>(null);
  const [newSupp, setNewSupp] = useState({
    name: "",
    dose_amount: 0,
    dose_unit: "mg",
    time_of_day: "morning",
    micronutrients: "" as string,
  });

  const createSupplement = useCreateSupplement();
  const updateSupplement = useUpdateSupplement();
  const deleteSupplementMutation = useDeleteSupplement();

  function addSupplement() {
    let microObj: Record<string, number> | null = null;
    if (newSupp.micronutrients.trim()) {
      try {
        microObj = JSON.parse(newSupp.micronutrients);
      } catch {
        toast.error("Micronutrients must be valid JSON, e.g. {\"vitamin_d\": 50}");
        return;
      }
    }
    createSupplement.mutate(
      {
        name: newSupp.name,
        dose_amount: newSupp.dose_amount,
        dose_unit: newSupp.dose_unit,
        time_of_day: newSupp.time_of_day,
        micronutrients: microObj,
      },
      {
        onSuccess: (created) => {
          setLitId((created as { id?: string } | undefined)?.id ?? null);
          setShowAddModal(false);
          setNewSupp({ name: "", dose_amount: 0, dose_unit: "mg", time_of_day: "morning", micronutrients: "" });
          toast.success("Supplement added");
        },
      }
    );
  }

  function toggleSuppActive(id: string, active: boolean) {
    updateSupplement.mutate({ id, active });
  }

  function deleteSupplement(supp: SupplementDefinition) {
    deleteSupplementMutation.mutate(supp.id, {
      onSuccess: () =>
        toast.success("Supplement removed", {
          action: {
            label: "Undo",
            onClick: () =>
              createSupplement.mutate(
                {
                  name: supp.name,
                  dose_amount: supp.dose_amount,
                  dose_unit: supp.dose_unit,
                  time_of_day: supp.time_of_day,
                  micronutrients: supp.micronutrients,
                },
                { onSuccess: () => toast.success("Supplement restored") }
              ),
          },
        }),
    });
  }

  return (
    <SettingsSection
      action={
        <Button variant="outline" size="sm" onClick={() => setShowAddModal(true)}>
          Add supplement
        </Button>
      }
    >
      <div>
        {supplements.length === 0 && (
          <p className="border-t border-g2 py-4 text-[13px] text-g4">No supplements defined</p>
        )}
        {supplements.map((s) => (
          <div
            key={s.id}
            className={`flex min-h-[60px] items-center gap-1 border-t border-g2 ${litId === s.id ? "animate-lit" : ""}`}
          >
            <button
              onClick={() => toggleSuppActive(s.id, !s.active)}
              aria-label={s.active ? `Deactivate ${s.name}` : `Activate ${s.name}`}
              aria-pressed={s.active}
              className="flex h-11 w-11 shrink-0 items-center justify-center"
            >
              <span
                className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border transition-colors duration-[var(--dur-fast)] ${
                  s.active ? "border-ink bg-ink" : "border-g3"
                }`}
              >
                {s.active && (
                  <svg className="h-3 w-3 text-g0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
            </button>
            <div className="min-w-0 flex-1 py-2">
              <p className={`truncate text-[15px] ${s.active ? "text-ink" : "text-g4 line-through"}`}>{s.name}</p>
              <p className="truncate text-xs text-g4 tabular-nums">
                {s.dose_amount} {s.dose_unit}
                {s.time_of_day ? ` · ${s.time_of_day}` : ""}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditingSupp(s)} aria-label={`Edit ${s.name}`}>
              Edit
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteSupplement(s)}
              aria-label={`Delete ${s.name}`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
        ))}
      </div>
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add supplement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="supp-name">Name</Label>
              <Input
                id="supp-name"
                type="text"
                value={newSupp.name}
                onChange={(e) => setNewSupp((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Vitamin D3"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="supp-dose">Dose</Label>
                <Input
                  id="supp-dose"
                  inputMode="decimal"
                  type="number"
                  value={newSupp.dose_amount}
                  onChange={(e) => setNewSupp((p) => ({ ...p, dose_amount: Number(e.target.value) }))}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supp-unit">Unit</Label>
                <NativeSelect
                  id="supp-unit"
                  value={newSupp.dose_unit}
                  onChange={(e) => setNewSupp((p) => ({ ...p, dose_unit: e.target.value }))}
                >
                  {DOSE_UNITS.map((u) => (
                    <option key={u} value={u} className="bg-g1">{u}</option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="supp-timing">Timing</Label>
              <NativeSelect
                id="supp-timing"
                value={newSupp.time_of_day}
                onChange={(e) => setNewSupp((p) => ({ ...p, time_of_day: e.target.value }))}
              >
                {TIMINGS.map((t) => (
                  <option key={t} value={t} className="bg-g1">{t}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="supp-micros">Micronutrients contributed (JSON, optional)</Label>
              <Input
                id="supp-micros"
                type="text"
                value={newSupp.micronutrients}
                onChange={(e) => setNewSupp((p) => ({ ...p, micronutrients: e.target.value }))}
                placeholder='{"vitamin_d": 50, "zinc": 10}'
                className="font-mono text-[13px]"
              />
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <Button
              onClick={addSupplement}
              disabled={!newSupp.name || createSupplement.isPending}
              className="flex-1"
              size="lg"
            >
              {createSupplement.isPending ? "Adding..." : "Add"}
            </Button>
            <Button
              onClick={() => setShowAddModal(false)}
              variant="outline"
              className="flex-1"
              size="lg"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <EditSupplementDialog supplement={editingSupp} onClose={() => setEditingSupp(null)} />
    </SettingsSection>
  );
}
