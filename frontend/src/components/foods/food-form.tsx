"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCreateFood, useUpdateFood } from "@/hooks/mutations/foods";
import { useFoodsSearch } from "@/hooks/queries";
import { atwaterMismatch } from "@/lib/portion";
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
  /** Prefills the barcode of a new food (after a scan that found nothing). */
  defaultBarcode?: string;
  onSuccess: (food: FoodDetail) => void;
  onCancel: () => void;
}

type NutrientFields = Record<keyof NutrientData, string>;

/** What the typed nutrient values refer to: 100 g (how they are stored) or one serving (US style labels). */
type Basis = "100g" | "serving";

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

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

export function FoodForm({ mode, initial, defaultBarcode, onSuccess, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [barcode, setBarcode] = useState(initial?.barcode ?? defaultBarcode ?? "");
  const [basis, setBasis] = useState<Basis>("100g");
  // The serving size the per serving values were converted with, for converting back if the field is cleared.
  const [basisServing, setBasisServing] = useState<number | null>(null);
  const [servingSizeG, setServingSizeG] = useState(initial?.serving_size_g != null ? String(initial.serving_size_g) : "");
  const [servingLabel, setServingLabel] = useState(initial?.serving_label ?? "");
  const [nutrients, setNutrients] = useState<NutrientFields>(fieldsFromFood(initial));

  // Before creating, show foods with a similar name so the same food isn't added twice.
  const [nameQuery, setNameQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setNameQuery(mode === "create" ? name.trim() : ""), 400);
    return () => clearTimeout(timer);
  }, [name, mode]);
  const { data: similar } = useFoodsSearch(nameQuery, 1, 5, nameQuery.length >= 3);
  const lookalikes = (similar?.items ?? []).filter((f) => f.id).slice(0, 3);

  const servingNum = Number(servingSizeG);
  const hasServing = servingSizeG !== "" && servingNum > 0;
  const perServing = basis === "serving";

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

  const num = (k: keyof NutrientData) => (nutrients[k] === "" ? null : Number(nutrients[k]));
  // Calories vs protein/carbs/fat works the same per serving or per 100 g.
  const kcalEstimate = atwaterMismatch({ kcal: num("kcal"), protein: num("protein"), carbs: num("carbs"), fat: num("fat"), alcohol: num("alcohol") });

  /** Switch what the fields mean and convert what is already typed, so nothing changes meaning. */
  function switchBasis(next: Basis) {
    if (next === basis) return;
    const size = hasServing ? servingNum : basisServing;
    if (!size) return;
    const factor = next === "serving" ? size / 100 : 100 / size;
    if (next === "serving") setBasisServing(size);
    setNutrients((prev) => {
      const out = { ...prev };
      for (const key of Object.keys(out) as (keyof NutrientData)[]) {
        if (out[key] !== "" && Number.isFinite(Number(out[key]))) out[key] = fmt(Number(out[key]) * factor);
      }
      return out;
    });
    setBasis(next);
  }

  const nameError = name.trim().length === 0 ? "Required" : null;
  const basisError = perServing && !hasServing ? "Enter the serving size, or switch back to per 100 g" : null;
  const hasErrors = !!nameError || !!basisError || Object.keys(nutrientErrors).length > 0;

  function setNutrient(key: keyof NutrientData, value: string) {
    setNutrients((prev) => ({ ...prev, [key]: value }));
  }

  function buildPayload() {
    const nutrientPayload: Partial<NutrientData> = {};
    // Stored per 100 g; label values per serving are scaled up.
    const toPer100 = perServing && hasServing ? 100 / servingNum : 1;
    for (const key of Object.keys(nutrients) as (keyof NutrientData)[]) {
      const raw = nutrients[key];
      if (raw !== "") nutrientPayload[key] = Math.round(Number(raw) * toPer100 * 1000) / 1000;
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
          {mode === "create" && lookalikes.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Already in your foods: {lookalikes.map((f) => f.name).join(", ")}. Search for it instead if it&apos;s the same.
            </p>
          )}
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Macros ({perServing ? `per serving, ${fmt(servingNum)} g` : "per 100 g"})
          </h4>
          {(hasServing || perServing) && (
            <div className="flex gap-1" role="group" aria-label="Values on the label are">
              {(["100g", "serving"] as Basis[]).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => switchBasis(b)}
                  aria-pressed={basis === b}
                  className={`h-9 px-3.5 rounded-full text-xs font-medium transition-colors duration-100 ${
                    basis === b ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {b === "100g" ? "Per 100 g" : "Per serving"}
                </button>
              ))}
            </div>
          )}
        </div>
        {!hasServing && !perServing && <p className="text-[11px] text-muted-foreground">Label only shows values per serving? Enter the serving size above first.</p>}
        {basisError && <p className="text-[11px] text-destructive">{basisError}</p>}
        {kcalEstimate != null && (
          <p className="pill pill-amber flex items-start gap-2 px-3 py-2 text-[11px] text-amber-300">
            <svg className="h-4 w-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
            <span>Calories look off: protein, carbs and fat add up to about {kcalEstimate} kcal. Check the label before saving.</span>
          </p>
        )}
        {renderNutrientGrid(MACRO_NUTRIENT_LABELS)}
      </section>

      <Separator />

      <section className="space-y-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Micronutrients ({perServing ? "per serving" : "per 100 g"}, optional)
        </h4>
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
