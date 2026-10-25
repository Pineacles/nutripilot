"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAddServing, useDeleteServing } from "@/hooks/mutations/food-log";
import { fmtGrams, type PortionUnit } from "@/lib/portion";
import type { Serving } from "@/lib/types";

interface Props {
  foodId: string;
  units: PortionUnit[];
  value: string;
  onChange: (key: string) => void;
  /** A new named serving was added: the dialog switches to it at 1. */
  onAdded: (serving: Serving) => void;
  /** The food's own serving name ("1 bar"), for the line under the chips. */
  servingLabel?: string | null;
}

const chip = (active: boolean) =>
  `h-10 px-4 rounded-full border text-[13px] font-medium transition-[color,background-color,border-color,transform] duration-[var(--dur-fast)] ease-[var(--ease-out)] active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 ${
    active ? "border-ink bg-ink text-g0" : "border-g3 text-g5 hover:border-g5 hover:text-ink"
  }`;

/**
 * Unit chips for an amount: the food's serving, the user's named servings ("slice"), grams, and
 * "+ Unit" to add one. Named servings are personal, so they can be added to any food.
 */
export function UnitPicker({ foodId, units, value, onChange, onAdded, servingLabel }: Props) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [grams, setGrams] = useState("");
  const addServing = useAddServing(foodId);
  const deleteServing = useDeleteServing(foodId);

  const selected = units.find((u) => u.key === value);
  // A pack label that is only the weight ("100g") adds nothing next to "= 100 g".
  const labelIsWeight = !!servingLabel && servingLabel.replace(/\s/g, "").toLowerCase() === `${fmtGrams(selected?.grams ?? 0)}g`;
  const gramsNum = Number(grams);
  const trimmed = label.trim();
  const duplicate = units.some((u) => u.name?.toLowerCase() === trimmed.toLowerCase());
  const formError = duplicate
    ? `You already have "${trimmed}"`
    : grams !== "" && !(gramsNum > 0 && gramsNum <= 5000)
      ? "Grams must be between 0 and 5000"
      : null;
  const canAdd = trimmed.length > 0 && grams !== "" && !formError;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canAdd) return;
    addServing.mutate(
      { label: trimmed, grams: gramsNum },
      {
        onSuccess: (serving) => {
          setAdding(false);
          setLabel("");
          setGrams("");
          onAdded(serving);
        },
      },
    );
  }

  function remove(unit: PortionUnit) {
    // Leave the removed unit first, so the amount is converted while its weight is still known.
    onChange("g");
    deleteServing.mutate(unit.key, {
      onSuccess: () =>
        toast.success(`Removed "${unit.label}"`, {
          action: { label: "Undo", onClick: () => addServing.mutate({ label: unit.label, grams: unit.grams }) },
        }),
    });
  }

  return (
    <div className="space-y-2">
      <div role="group" aria-label="Unit" className="flex flex-wrap gap-2">
        {units.map((u) => (
          <button key={u.key} type="button" onClick={() => onChange(u.key)} aria-pressed={value === u.key} className={chip(value === u.key)}>
            {u.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          aria-expanded={adding}
          className="flex h-10 items-center gap-1 rounded-full border border-dashed border-g3 px-4 text-[13px] font-medium text-g5 transition-colors duration-[var(--dur-fast)] hover:border-g5 hover:text-ink"
        >
          <Plus className="h-3.5 w-3.5" />
          Unit
        </button>
      </div>

      {selected && selected.key !== "g" && !adding && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-g4 tabular-nums">
          <span>
            {selected.key === "serving" ? (!labelIsWeight && servingLabel) || "1 serving" : `1 ${selected.label}`} = {fmtGrams(selected.grams)} g
          </span>
          {selected.name && <span aria-hidden>·</span>}
          {selected.name && (
            <button
              type="button"
              onClick={() => remove(selected)}
              disabled={deleteServing.isPending}
              className="-my-2 rounded px-1.5 py-2 font-medium text-g5 underline decoration-dotted underline-offset-2 hover:text-ink disabled:opacity-50"
            >
              Remove unit
            </button>
          )}
        </p>
      )}

      {adding && (
        <form onSubmit={submit} className="space-y-2 border-t border-g2 pt-3">
          <div className="grid grid-cols-[1fr_6.5rem] gap-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="slice, cup, piece"
              maxLength={40}
              aria-label="Unit name"
              autoFocus
            />
            <div className="relative">
              <Input
                type="number"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                placeholder="30"
                min={0}
                max={5000}
                step="any"
                inputMode="decimal"
                aria-label="Grams in one unit"
                aria-invalid={!!formError && grams !== ""}
                className="pr-7 tabular-nums"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-g4">g</span>
            </div>
          </div>
          {formError ? (
            <p className="text-xs text-ink">{formError}</p>
          ) : (
            <p className="text-xs text-g4">How much one weighs. Only you see your units.</p>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!canAdd || addServing.isPending}>
              {addServing.isPending ? "Adding..." : "Add unit"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
