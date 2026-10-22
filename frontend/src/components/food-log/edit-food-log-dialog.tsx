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
import { convertAmount, toGrams } from "@/lib/portion";
import type { FoodLogDetailEntry, LogUnit, MealType } from "@/lib/types";

interface Props {
  entry: FoodLogDetailEntry | null;
  onClose: () => void;
}

/** Edit (amount in grams or servings, meal, date = "move to another day") or delete a single food log entry. */
export function EditFoodLogDialog({ entry, onClose }: Props) {
  const [quantity, setQuantity] = useState("0");
  const [unit, setUnit] = useState<LogUnit>("g");
  // Only an amount the user changed is sent, so moving an entry to another meal or day keeps its grams
  // even if the food's serving size was edited since it was logged.
  const [amountTouched, setAmountTouched] = useState(false);
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
      const servings = entry.unit === "serving" && entry.amount != null && !!entry.serving_size_g;
      setUnit(servings ? "serving" : "g");
      setQuantity(String(servings ? entry.amount : entry.quantity_g));
      setMealType(entry.meal_type as MealType);
      setDate(entry.date);
      setConfirmingDelete(false);
      setAmountTouched(false);
    });
    return () => {
      cancelled = true;
    };
  }, [entry]);

  const quantityNum = Number(quantity);
  const quantityError = validateBounds(quantityNum, unit === "g" ? FOOD_LOG_BOUNDS.quantity_g : FOOD_LOG_BOUNDS.servings);
  const grams = amountTouched ? toGrams(quantityNum || 0, unit, entry?.serving_size_g) : entry?.quantity_g ?? 0;
  // Live numbers for the amount being typed, from the per 100 g values.
  const preview = (key: "kcal" | "protein" | "carbs" | "fat") => {
    const per100 = entry?.nutrients_per_100g?.[key];
    return per100 != null ? (per100 * grams) / 100 : entry?.nutrients_consumed[key] ?? null;
  };

  function switchUnit(next: LogUnit) {
    if (next === unit || !entry) return;
    // Convert from the grams actually logged, not a re-rounded serving count.
    const base = amountTouched ? grams : entry.quantity_g;
    setQuantity(String(convertAmount(base, "g", next, entry.serving_size_g)));
    setUnit(next);
    setAmountTouched(true);
  }

  function handleSave() {
    if (!entry || quantityError) return;
    updateLog.mutate(
      {
        id: entry.id,
        ...(amountTouched ? (unit === "g" ? { quantity_g: quantityNum } : { servings: quantityNum }) : {}),
        meal_type: mealType,
        date,
      },
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
                    {preview(key) != null ? Math.round(preview(key)!) : "--"}
                  </p>
                </div>
              ))}
            </div>

            {entry.serving_size_g ? (
              <div className="flex items-center gap-1.5">
                {(["serving", "g"] as LogUnit[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchUnit(m)}
                    aria-pressed={unit === m}
                    className={`h-9 px-3.5 rounded-full text-xs font-medium transition-colors duration-100 ${
                      unit === m ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {m === "g" ? "Grams" : "Servings"}
                  </button>
                ))}
                <span className="ml-1 text-[11px] text-muted-foreground truncate">
                  {entry.serving_label || "1 serving"} = {entry.serving_size_g} g
                </span>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{unit === "g" ? "Quantity (g)" : "Servings"}</Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setAmountTouched(true);
                }}
                min={unit === "g" ? FOOD_LOG_BOUNDS.quantity_g.min : FOOD_LOG_BOUNDS.servings.min}
                max={unit === "g" ? FOOD_LOG_BOUNDS.quantity_g.max : FOOD_LOG_BOUNDS.servings.max}
                step={unit === "g" ? 1 : 0.25}
                inputMode="decimal"
                aria-invalid={!!quantityError}
                className="tabular-nums"
              />
              {quantityError ? (
                <p className="text-[11px] text-destructive">{quantityError}</p>
              ) : unit === "serving" ? (
                <p className="text-[11px] text-muted-foreground tabular-nums">{Math.round(grams * 10) / 10} g</p>
              ) : null}
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
