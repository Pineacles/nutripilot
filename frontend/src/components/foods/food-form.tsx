"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateFood, useUpdateFood } from "@/hooks/mutations/foods";
import { useFoodsSearch } from "@/hooks/queries";
import { atwaterMismatch, labelProblem } from "@/lib/portion";
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

const field = "h-12 rounded-[14px] border-g3 px-3.5 text-base focus-visible:border-ink focus-visible:ring-0 aria-invalid:border-ink aria-invalid:ring-0";
const labelCls = "text-[12px] font-normal text-g4";
const errorCls = "text-[12px] text-ink";

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
  // "Required" waits until the field was left empty or saving was tried, not the moment the form opens.
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [attempted, setAttempted] = useState(false);
  const touch = (key: string) => setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  const shown = (key: string, error: string | null | undefined) =>
    error && (error !== "Required" || attempted || touched.has(key)) ? error : null;

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
  // Checked per 100 g, so per serving values count after scaling up.
  const per100 = (k: keyof NutrientData) => {
    const v = num(k);
    return v == null ? null : perServing && hasServing ? (v * 100) / servingNum : v;
  };
  const labelWarning = labelProblem({ protein: per100("protein"), carbs: per100("carbs"), sugar: per100("sugar"), fat: per100("fat"), sat_fat: per100("sat_fat") });

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
    setAttempted(true);
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Object.entries(fields).map(([key, meta]) => {
          const k = key as keyof NutrientData;
          const error = shown(k, nutrientErrors[k]);
          return (
            <div key={key} className="space-y-1.5">
              <Label className={labelCls}>{meta.label}</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={nutrients[k]}
                  onChange={(e) => setNutrient(k, e.target.value)}
                  onBlur={() => touch(k)}
                  min={0}
                  step="any"
                  aria-invalid={!!error}
                  aria-label={`${meta.label} in ${meta.unit} ${perServing ? "per serving" : "per 100 g"}`}
                  placeholder={k === "kcal" ? "required" : "optional"}
                  className={`${field} pr-12 tabular-nums`}
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] text-g4">{meta.unit}</span>
              </div>
              {error && <p className={errorCls}>{error}</p>}
            </div>
          );
        })}
      </div>
    );
  }

  const warn = (text: string) => (
    <p className="flex items-start gap-2 border-y border-g2 py-3 text-[13px] text-ink">
      <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
      <span>{text}</span>
    </p>
  );

  const basisUnit = perServing ? `per serving, ${fmt(servingNum)} g` : "per 100 g";
  return (
    <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1 thin-scrollbar">
      <section className="space-y-3">
        <h4 className="text-[15px] font-medium text-ink">Food</h4>
        <div className="space-y-1.5">
          <Label className={labelCls}>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => touch("name")} aria-invalid={!!shown("name", nameError)} placeholder="e.g. Rolled oats" className={field} />
          {shown("name", nameError) && <p className={errorCls}>{nameError}</p>}
          {mode === "create" && lookalikes.length > 0 && (
            <p className="text-[12px] text-g4">
              Already in your foods: {lookalikes.map((f) => f.name).join(", ")}. Search for it instead if it&apos;s the same.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className={labelCls}>Barcode (optional)</Label>
            <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} className={`${field} font-mono`} placeholder="EAN/UPC" />
          </div>
          <div className="space-y-1.5">
            <Label className={labelCls}>Serving size in g (optional)</Label>
            <Input type="number" value={servingSizeG} onChange={(e) => setServingSizeG(e.target.value)} min={0} className={`${field} tabular-nums`} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className={labelCls}>Serving label (optional)</Label>
          <Input value={servingLabel} onChange={(e) => setServingLabel(e.target.value)} placeholder="e.g. 1 cup, 1 slice" className={field} />
        </div>
      </section>

      <section className="space-y-3 border-t border-g2 pt-5">
        <div>
          <h4 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink">Nutrition {basisUnit}</h4>
          <p className="mt-1 text-[13px] text-g5">
            {perServing
              ? "You are entering the label's per serving column. It is saved per 100 g."
              : "Type the label's per 100 g column. Not the per serving one."}
          </p>
        </div>
        {(hasServing || perServing) && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Values on the label are">
            {(["100g", "serving"] as Basis[]).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => switchBasis(b)}
                aria-pressed={basis === b}
                className={`h-10 rounded-full border px-4 text-[13px] font-medium transition-colors ${
                  basis === b ? "border-ink bg-ink text-g0" : "border-g3 bg-g0 text-g5 hover:border-g5"
                }`}
              >
                {b === "100g" ? "Per 100 g" : "Per serving"}
              </button>
            ))}
          </div>
        )}
        {!hasServing && !perServing && <p className="text-[12px] text-g4">Label only shows values per serving? Enter the serving size above, then switch to per serving.</p>}
        {basisError && <p className={errorCls}>{basisError}</p>}
        {kcalEstimate != null && warn(`Calories look off: protein, carbs and fat add up to about ${kcalEstimate} kcal. Check the label before saving.`)}
        {labelWarning && warn(labelWarning)}
        {renderNutrientGrid(MACRO_NUTRIENT_LABELS)}
      </section>

      <section className="space-y-3 border-t border-g2 pt-5">
        <h4 className="text-[15px] font-medium text-ink">
          Vitamins and minerals <span className="text-[12px] font-normal text-g4">{perServing ? "per serving" : "per 100 g"}, optional</span>
        </h4>
        {renderNutrientGrid(MICRO_NUTRIENT_LABELS)}
      </section>

      <div className="sticky bottom-0 flex gap-2 border-t border-g2 bg-popover pt-3">
        <button
          onClick={handleSubmit}
          disabled={pending}
          className="h-12 flex-1 rounded-full bg-ink text-[15px] font-medium text-g0 transition-transform active:scale-[0.98] disabled:bg-g3 disabled:text-g5"
        >
          {pending ? "Saving..." : mode === "edit" ? "Save changes" : "Create food"}
        </button>
        <button
          onClick={onCancel}
          className="h-12 rounded-full border border-g3 px-5 text-[13px] font-medium text-ink transition-colors hover:border-g5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
