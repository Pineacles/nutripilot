"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
        onSuccess: () => {
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

  function deleteSupplement(id: string) {
    deleteSupplementMutation.mutate(id, {
      onSuccess: () => toast.success("Supplement removed"),
    });
  }

  return (
    <div className="clay-card p-5 md:col-span-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Supplement Management</h3>
      <div className="space-y-2 max-h-[320px] overflow-y-auto">
        {supplements.length === 0 && (
          <p className="text-sm text-muted-foreground">No supplements defined</p>
        )}
        {supplements.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-3 rounded-xl bg-muted/30 border border-border px-3 py-2.5 transition-colors hover:bg-muted/50"
          >
            <button
              onClick={() => toggleSuppActive(s.id, !s.active)}
              className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                s.active
                  ? "border-primary/40 bg-primary/10"
                  : "border-border bg-muted/50"
              }`}
            >
              {s.active && (
                <svg className="h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm truncate ${s.active ? "text-foreground/80" : "text-muted-foreground line-through"}`}>
                {s.name}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {s.dose_amount} {s.dose_unit}
                </Badge>
                {s.time_of_day && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                    {s.time_of_day}
                  </Badge>
                )}
              </div>
            </div>
            <button
              onClick={() => setEditingSupp(s)}
              className="text-muted-foreground/40 hover:text-foreground transition-colors text-xs px-1"
            >
              Edit
            </button>
            <button
              onClick={() => deleteSupplement(s.id)}
              className="text-muted-foreground/40 hover:text-destructive transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <Separator className="my-3" />
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogTrigger
          render={
            <Button variant="outline" className="w-full" />
          }
        >
          + Add Supplement
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Supplement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input
                type="text"
                value={newSupp.name}
                onChange={(e) => setNewSupp((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Vitamin D3"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Dose</Label>
                <Input
                  type="number"
                  value={newSupp.dose_amount}
                  onChange={(e) => setNewSupp((p) => ({ ...p, dose_amount: Number(e.target.value) }))}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Unit</Label>
                <select
                  value={newSupp.dose_unit}
                  onChange={(e) => setNewSupp((p) => ({ ...p, dose_unit: e.target.value }))}
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
                value={newSupp.time_of_day}
                onChange={(e) => setNewSupp((p) => ({ ...p, time_of_day: e.target.value }))}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {TIMINGS.map((t) => (
                  <option key={t} value={t} className="bg-card">{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Micronutrients contributed (JSON, optional)
              </Label>
              <Input
                type="text"
                value={newSupp.micronutrients}
                onChange={(e) => setNewSupp((p) => ({ ...p, micronutrients: e.target.value }))}
                placeholder='{"vitamin_d": 50, "zinc": 10}'
                className="text-xs font-mono"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-2">
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
    </div>
  );
}
