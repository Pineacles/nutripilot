"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCreateFood, useUpdateFood } from "@/hooks/mutations/foods";
import { validateNonNegative } from "@/lib/validation";
import { MACRO_NUTRIENT_LABELS, MICRO_NUTRIENT_LABELS } from "@/lib/nutrient-labels";
import { getErrorMessage } from "@/lib/api";
import type { FoodDetail, NutrientData } from "@/lib/types";

interface Props {
  /** "edit" pre-fills from `initial` and PUTs; "create" (default) POSTs a new food.
   *  The "clone & customize" flow calls POST /clone first, then reuses this component
   *  in "edit" mode against the freshly-cloned (now owned) record. */
  mode: "create" | "edit";
  initial?: FoodDetail | null;
  onSuccess: (food: FoodDetail) => void;
  onCancel: () => void;
}

type NutrientFields = Record<keyof NutrientData, string>;

function emptyNutrientFields(): NutrientFields {
  return {
    kcal: "", protein: "", carbs: "", sugar: "", fiber: "", fat: "", sat_fat: "", salt: "",
    calcium: "", potassium: "", omega3: "", zinc: "", vit_d: "", vit_k2: "", vit_c: "",
    magnesium: "", b12: "", iron: "", alcohol: "", caffeine_mg: "",
  };
}

function fieldsFromFood(food?: FoodDetail | null): NutrientFields {
  const base = emptyNutrientFields();
  if (!food?.nutrients) return base;
  for (const key of Object.keys(base) as (keyof NutrientData)[]) {
    const v = food.nutrients[key];
    if (v != null) base[key] = String(v);
  }
  return base;
}

export function FoodForm({ mode, initial, onSuccess, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [barcode, setBarcode] = useState(initial?.barcode ?? "");
  const [servingSizeG, setServingSizeG] = useState(initial?.serving_size_g != null ? String(initial.serving_size_g) : "");
  const [servingLabel, setServingLabel] = useState(initial?.serving_label ?? "");
  const [nutrients, setNutrients] = useState<NutrientFields>(fieldsFromFood(initial));

  const createFood = useCreateFood();
  const updateFood = useUpdateFood();
  const pending = createFood.isPending || updateFood.isPending;

  const nutrientErrors = useMemo(() => {
    const errs: Partial<Record<keyof NutrientData, string>> = {};
    for (const key of Object.keys(nutrients) as (keyof NutrientData)[]) {
      const raw = nutrients[key];
      if (raw === "") continue;
      const num = Number(raw);
      const msg = validateNonNegative(num);
      if (msg) errs[key] = msg;
    }
    if (nutrients.kcal === "") errs.kcal = "Required";
    return errs;
  }, [nutrients]);

  const nameError = name.trim().length === 0 ? "Required" : null;
  const hasErrors = !!nameError || Object.keys(nutrientErrors).length > 0;

  function setNutrient(key: keyof NutrientData, value: string) {
    setNutrients((prev) => ({ ...prev, [key]: value }));
  }

  function buildPayload() {
    const nutrientPayload: Partial<NutrientData> = {};
    for (const key of Object.keys(nutrients) as (keyof NutrientData)[]) {
      const raw = nutrients[key];
      if (raw !== "") nutrientPayload[key] = Number(raw);
    }
    return {
      name: name.trim(),
      barcode: barcode.trim() || null,
      serving_size_g: servingSizeG === "" ? null : Number(servingSizeG),
      serving_label: servingLabel.trim() || null,
      nutrients: nutrientPayload,
    };
  }

  function handleSubmit() {
    if (hasErrors) {
      toast.error("Fix the highlighted fields before saving.");
      return;
    }
    const payload = buildPayload();
    if (mode === "edit" && initial) {
      updateFood.mutate(
        { id: initial.id, ...payload },
        {
          onSuccess: (food) => { toast.success("Food updated"); onSuccess(food); },
          onError: (err) => toast.error(getErrorMessage(err, "Couldn't update food.")),
        }
      );
    } else {
      createFood.mutate(payload, {
        onSuccess: (food) => { toast.success("Food created"); onSuccess(food); },
        onError: (err) => toast.error(getErrorMessage(err, "Couldn't create food.")),
      });
    }
  }

  function renderNutrientGrid(fields: Record<string, { label: string; unit: string }>) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Object.entries(fields).map(([key, meta]) => {
          const k = key as keyof NutrientData;
          const error = nutrientErrors[k];
          return (
            <div key={key} className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">{meta.label} <span className="text-muted-foreground/50">({meta.unit})</span></Label>
              <Input
                type="number"
                value={nutrients[k]}
                onChange={(e) => setNutrient(k, e.target.value)}
                min={0}
                step="any"
                aria-invalid={!!error}
                placeholder={k === "kcal" ? "required" : "optional"}
                className="tabular-nums"
              />
              {error && <p className="text-[10px] text-destructive">{error}</p>}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-5 max-h-[70vh] overflow-y-auto thin-scrollbar pr-1">
      {/* Basics */}
      <section className="space-y-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Basics</h4>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!nameError} placeholder="e.g. Rolled oats" />
          {nameError && <p className="text-[11px] text-destructive">{nameError}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Barcode (optional)</Label>
            <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="font-mono" placeholder="EAN/UPC" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Serving size (g, optional)</Label>
            <Input type="number" value={servingSizeG} onChange={(e) => setServingSizeG(e.target.value)} min={0} className="tabular-nums" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Serving label (optional)</Label>
          <Input value={servingLabel} onChange={(e) => setServingLabel(e.target.value)} placeholder="e.g. 1 cup, 1 slice" />
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Macros (per 100g)</h4>
        {renderNutrientGrid(MACRO_NUTRIENT_LABELS)}
      </section>

      <Separator />

      <section className="space-y-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Micronutrients (per 100g, optional)</h4>
        {renderNutrientGrid(MICRO_NUTRIENT_LABELS)}
      </section>

      <div className="flex gap-2 pt-2 sticky bottom-0 bg-popover">
        <Button onClick={handleSubmit} disabled={hasErrors || pending} size="lg" className="flex-1">
          {pending ? "Saving..." : mode === "edit" ? "Save changes" : "Create food"}
        </Button>
        <Button onClick={onCancel} variant="outline" size="lg">Cancel</Button>
      </div>
    </div>
  );
}
