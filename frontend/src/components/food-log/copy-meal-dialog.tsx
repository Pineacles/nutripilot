"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useCopyFoodLogs, useRemoveFoodLogs } from "@/hooks/mutations/food-log";
import { useFoodLogDay } from "@/hooks/queries";
import { MEAL_TYPES, MEAL_TYPE_LABELS } from "@/lib/meal-types";
import { addDays, parseLocal, todayStr } from "@/lib/dates";
import type { FoodLogCopyInput, MealType } from "@/lib/types";

/** "today", "tomorrow", "yesterday" or "Tue, Oct 14", for toasts and buttons. */
export function dayName(date: string): string {
  const today = todayStr();
  if (date === today) return "today";
  if (date === addDays(today, 1)) return "tomorrow";
  if (date === addDays(today, -1)) return "yesterday";
  return parseLocal(date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** Copies a meal and offers Undo in the toast, which removes exactly the entries the copy made. */
export function useCopyMeal() {
  const copy = useCopyFoodLogs();
  const remove = useRemoveFoodLogs();
  function run(input: FoodLogCopyInput, onDone?: () => void, onFail?: () => void) {
    copy.mutate(input, {
      onError: () => onFail?.(),
      onSuccess: (created) => {
        const meal = MEAL_TYPE_LABELS[(input.to_meal_type ?? input.meal_type) as MealType] ?? "Meal";
        toast.success(`${meal} logged for ${dayName(input.to_date)}`, {
          description: `${created.length} ${created.length === 1 ? "item" : "items"} copied`,
          action: { label: "Undo", onClick: () => remove.mutate(created.map((c) => c.id)) },
        });
        onDone?.();
      },
    });
  }
  return { run, isPending: copy.isPending };
}

interface Props {
  /** The meal to copy, or null when closed. */
  source: { date: string; meal_type: MealType; items: number; kcal: number } | null;
  onClose: () => void;
}

/** Copy one meal to another day and/or meal: "same breakfast as yesterday", or planning tomorrow. */
export function CopyMealDialog({ source, onClose }: Props) {
  const [toDate, setToDate] = useState("");
  const [toMeal, setToMeal] = useState<MealType>("breakfast");
  const [openedFor, setOpenedFor] = useState<typeof source>(null);
  const { run, isPending } = useCopyMeal();

  // Defaults per opened meal: a past day goes to today, today goes to tomorrow; same meal.
  if (source && source !== openedFor) {
    setOpenedFor(source);
    const today = todayStr();
    setToDate(source.date < today ? today : addDays(source.date, 1));
    setToMeal(source.meal_type);
  }

  const sameSpot = !!source && toDate === source.date && toMeal === source.meal_type;
  // Copying adds to what is there; say so when the target meal already has entries.
  const { data: target } = useFoodLogDay(toDate, !!source && !!toDate && !sameSpot);
  const alreadyThere = target?.entries.filter((e) => e.meal_type === toMeal).length ?? 0;

  function submit() {
    if (!source || !toDate || sameSpot) return;
    run(
      {
        from_date: source.date,
        to_date: toDate,
        meal_type: source.meal_type,
        ...(toMeal !== source.meal_type ? { to_meal_type: toMeal } : {}),
      },
      onClose,
    );
  }

  return (
    <Dialog open={!!source} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Copy {source ? MEAL_TYPE_LABELS[source.meal_type].toLowerCase() : "meal"}</DialogTitle>
        </DialogHeader>
        {source && (
          <div className="space-y-4">
            <p className="text-[13px] text-g4 tabular-nums">
              {source.items} {source.items === 1 ? "item" : "items"} · {Math.round(source.kcal)} kcal, amounts as logged
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="copy-day">To day</Label>
                <Input id="copy-day" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="copy-meal">As meal</Label>
                <NativeSelect id="copy-meal" value={toMeal} onChange={(e) => setToMeal(e.target.value as MealType)}>
                  {MEAL_TYPES.map((mt) => (
                    <option key={mt} value={mt} className="bg-g1">{MEAL_TYPE_LABELS[mt]}</option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            {sameSpot ? (
              <p className="text-xs text-g4">Pick another day or meal, this is where it already is.</p>
            ) : alreadyThere > 0 ? (
              <p className="border-t border-g2 pt-3 text-xs text-g5">
                {MEAL_TYPE_LABELS[toMeal]} on {dayName(toDate)} already has {alreadyThere} {alreadyThere === 1 ? "item" : "items"}. Copying adds to them.
              </p>
            ) : null}
            <div className="flex gap-2 pt-1">
              <Button onClick={submit} disabled={!toDate || sameSpot || isPending} size="lg" className="flex-1">
                {isPending ? "Copying..." : `Copy to ${toDate ? dayName(toDate) : "..."}`}
              </Button>
              <Button onClick={onClose} variant="outline" size="lg">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
