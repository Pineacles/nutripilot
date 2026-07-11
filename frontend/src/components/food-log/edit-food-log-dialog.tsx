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
import { useUpdateFoodLog, useDeleteFoodLog } from "@/hooks/mutations/food-log";
import { FOOD_LOG_BOUNDS, validateBounds } from "@/lib/validation";
import { MEAL_TYPES, MEAL_TYPE_LABELS } from "@/lib/meal-types";
import type { FoodLogDetailEntry, MealType } from "@/lib/types";

interface Props {
  entry: FoodLogDetailEntry | null;
  onClose: () => void;
}

/** Edit (quantity/meal/date — moving date = "move to another day") or delete a single food log entry. */
export function EditFoodLogDialog({ entry, onClose }: Props) {
  const [quantityG, setQuantityG] = useState("0");
  const [mealType, setMealType] = useState<MealType>("snack");
  const [date, setDate] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const updateLog = useUpdateFoodLog();
  const deleteLog = useDeleteFoodLog();

  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setQuantityG(String(entry.quantity_g));
      setMealType(entry.meal_type as MealType);
      setDate(entry.date);
      setConfirmingDelete(false);
    });
    return () => {
      cancelled = true;
    };
  }, [entry]);

  const quantityNum = Number(quantityG);
  const quantityError = validateBounds(quantityNum, FOOD_LOG_BOUNDS.quantity_g);

  function handleSave() {
    if (!entry || quantityError) return;
    updateLog.mutate(
      { id: entry.id, quantity_g: quantityNum, meal_type: mealType, date },
      {
        onSuccess: () => {
          toast.success("Food log updated");
          onClose();
        },
      }
    );
  }

  function handleDelete() {
    if (!entry) return;
    deleteLog.mutate(entry.id, {
      onSuccess: () => {
        toast.success("Removed from log");
        onClose();
      },
    });
  }

  return (
    <Dialog open={!!entry} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{entry?.food_name}</DialogTitle>
        </DialogHeader>
        {entry && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-1.5">
              {([
                ["kcal", "Kcal"],
                ["protein", "Protein"],
                ["carbs", "Carbs"],
                ["fat", "Fat"],
              ] as const).map(([key, label]) => (
                <div key={key} className="pill rounded-lg p-2 text-center">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {entry.nutrients_consumed[key] != null ? Math.round(entry.nutrients_consumed[key]!) : "--"}
                  </p>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Quantity (g)</Label>
              <Input
                type="number"
                value={quantityG}
                onChange={(e) => setQuantityG(e.target.value)}
                min={FOOD_LOG_BOUNDS.quantity_g.min}
                max={FOOD_LOG_BOUNDS.quantity_g.max}
                aria-invalid={!!quantityError}
                className="tabular-nums"
              />
              {quantityError && <p className="text-[11px] text-destructive">{quantityError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Meal</Label>
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value as MealType)}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  {MEAL_TYPES.map((mt) => (
                    <option key={mt} value={mt} className="bg-card">{MEAL_TYPE_LABELS[mt]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="tabular-nums" />
                {date !== entry.date && (
                  <p className="text-[10px] text-primary/80">Will move to {date}</p>
                )}
              </div>
            </div>

            {!confirmingDelete ? (
              <div className="flex gap-2 pt-1">
                <Button onClick={handleSave} disabled={!!quantityError || updateLog.isPending} className="flex-1" size="lg">
                  {updateLog.isPending ? "Saving..." : "Save"}
                </Button>
                <Button onClick={() => setConfirmingDelete(true)} variant="destructive" size="lg">
                  Delete
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 space-y-2">
                <p className="text-xs text-destructive/80">Remove this entry from your log?</p>
                <div className="flex gap-2">
                  <Button onClick={handleDelete} disabled={deleteLog.isPending} variant="destructive" className="flex-1">
                    {deleteLog.isPending ? "Removing..." : "Confirm"}
                  </Button>
                  <Button onClick={() => setConfirmingDelete(false)} variant="outline" className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
