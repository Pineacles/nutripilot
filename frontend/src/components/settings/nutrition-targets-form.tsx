"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { plateOf } from "@/lib/plates";
import { SettingsSection, FieldRow } from "./section";
import { useUpdateNutritionTargets } from "@/hooks/queries";
import { useTracked } from "@/hooks/use-tracked";
import { NUTRITION_TARGET_BOUNDS, GOAL_BOUNDS, validateBounds } from "@/lib/validation";
import type { NutritionTargets } from "@/lib/types";

const DEFAULT_NUTRITION_TARGETS: NutritionTargets = {
  target_kcal: 2000,
  target_protein_g: 150,
  target_carbs_g: 250,
  target_fat_g: 70,
  target_fiber_g: 30,
  target_sugar_g: 50,
  target_sodium_mg: 2300,
  target_alcohol_g: 0,
  target_water_ml: 2500,
  target_caffeine_mg: 400,
  target_weight_kg: null,
  target_body_fat_pct: null,
  timezone: null,
};

const TIMEZONES: string[] = typeof Intl !== "undefined" && "supportedValuesOf" in Intl
  ? (Intl as unknown as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf("timeZone")
  : [];

// Nutrients with a plate ink get a swatch; sugar, sodium and calories have none.
const PLATED = new Set(["protein", "carbs", "fat", "fiber", "water", "caffeine", "alcohol"]);

const FIELDS = [
  { label: "Calories", key: "target_kcal" as const, unit: "kcal" },
  { label: "Protein", key: "target_protein_g" as const, unit: "g" , track: "protein"},
  { label: "Carbs", key: "target_carbs_g" as const, unit: "g" , track: "carbs"},
  { label: "Fat", key: "target_fat_g" as const, unit: "g" , track: "fat"},
  { label: "Fiber", key: "target_fiber_g" as const, unit: "g" , track: "fiber"},
  { label: "Sugar limit", key: "target_sugar_g" as const, unit: "g" , track: "sugar"},
  { label: "Sodium limit", key: "target_sodium_mg" as const, unit: "mg" , track: "salt"},
  { label: "Alcohol limit", key: "target_alcohol_g" as const, unit: "g" , track: "alcohol"},
  { label: "Water", key: "target_water_ml" as const, unit: "ml" , track: "water"},
  { label: "Caffeine limit", key: "target_caffeine_mg" as const, unit: "mg" , track: "caffeine"},
];

interface Props {
  initial: NutritionTargets | undefined;
}

export function NutritionTargetsForm({ initial }: Props) {
  const [nutrition, setNutrition] = useState<NutritionTargets>(DEFAULT_NUTRITION_TARGETS);
  const updateNutritionTargets = useUpdateNutritionTargets();
  const { shows } = useTracked();
  // Targets for hidden nutrients leave the list; calories always stay.
  const fields = FIELDS.filter((f) => !("track" in f) || shows(f.track as string));
  // Bumped after a save: the rows flash once.
  const [saved, setSaved] = useState(0);

  useEffect(() => {
    if (!initial) return;
    // Defer to a microtask so this isn't a synchronous setState call at the
    // effect top level (avoids react-hooks/set-state-in-effect).
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setNutrition(initial);
    });
    return () => {
      cancelled = true;
    };
  }, [initial]);

  const nutritionErrors = useMemo(() => {
    const errs: Partial<Record<keyof NutritionTargets, string>> = {};
    for (const key of Object.keys(NUTRITION_TARGET_BOUNDS) as (keyof typeof NUTRITION_TARGET_BOUNDS)[]) {
      const msg = validateBounds(nutrition[key], NUTRITION_TARGET_BOUNDS[key]);
      if (msg) errs[key] = msg;
    }
    return errs;
  }, [nutrition]);
  const goalWeightError = nutrition.target_weight_kg == null ? null : validateBounds(nutrition.target_weight_kg, GOAL_BOUNDS.target_weight_kg);
  const goalBfError = nutrition.target_body_fat_pct == null ? null : validateBounds(nutrition.target_body_fat_pct, GOAL_BOUNDS.target_body_fat_pct);
  const tzError = nutrition.timezone && !TIMEZONES.includes(nutrition.timezone) ? "Not a recognized IANA timezone" : null;
  const hasNutritionErrors = Object.keys(nutritionErrors).length > 0 || !!goalWeightError || !!goalBfError || !!tzError;

  function saveNutritionTargets() {
    if (hasNutritionErrors) {
      toast.error("Fix the highlighted fields before saving.");
      return;
    }
    updateNutritionTargets.mutate(nutrition, {
      onSuccess: () => {
        toast.success("Nutrition targets saved");
        setSaved((n) => n + 1);
      },
    });
  }

  return (
    <SettingsSection title="Nutrition targets" description="Daily goals and limits shown on Today." className="md:col-span-1">
      <div>
        {fields.map((field) => {
          const bounds = NUTRITION_TARGET_BOUNDS[field.key];
          return (
            <FieldRow
              key={`${field.key}-${saved}`}
              label={
                "track" in field && field.track && PLATED.has(field.track) ? (
                  <span className="flex items-center gap-2.5">
                    <span aria-hidden="true" className="inline-block size-[10px] shrink-0" style={{ background: plateOf(field.track) }} />
                    {field.label}
                  </span>
                ) : (
                  field.label
                )
              }
              htmlFor={`nt-${field.key}`}
              unit={field.unit}
              error={nutritionErrors[field.key]}
              lit={saved > 0}
            >
              <Input
                id={`nt-${field.key}`}
                type="number"
                inputMode="decimal"
                value={nutrition[field.key]}
                min={bounds.min}
                max={bounds.max}
                aria-invalid={!!nutritionErrors[field.key]}
                onChange={(e) =>
                  setNutrition((prev) => ({ ...prev, [field.key]: Number(e.target.value) }))
                }
                className="w-28 text-right tabular-nums"
              />
            </FieldRow>
          );
        })}
      </div>

      <h4 className="mt-6 text-[15px] font-medium text-ink">Goals (optional)</h4>
      <div>
        <FieldRow label="Goal weight" htmlFor="nt-goal-weight" unit="kg" error={goalWeightError}>
          <Input
            id="nt-goal-weight"
            type="number"
            inputMode="decimal"
            value={nutrition.target_weight_kg ?? ""}
            onChange={(e) => setNutrition((prev) => ({ ...prev, target_weight_kg: e.target.value === "" ? null : Number(e.target.value) }))}
            aria-invalid={!!goalWeightError}
            placeholder="no goal"
            className="w-28 text-right tabular-nums"
          />
        </FieldRow>
        <FieldRow label="Goal body fat" htmlFor="nt-goal-bf" unit="%" error={goalBfError}>
          <Input
            id="nt-goal-bf"
            type="number"
            inputMode="decimal"
            value={nutrition.target_body_fat_pct ?? ""}
            onChange={(e) => setNutrition((prev) => ({ ...prev, target_body_fat_pct: e.target.value === "" ? null : Number(e.target.value) }))}
            aria-invalid={!!goalBfError}
            placeholder="no goal"
            className="w-28 text-right tabular-nums"
          />
        </FieldRow>
      </div>

      <div className="space-y-1.5 border-t border-g2 pt-4">
        <Label htmlFor="nt-timezone">Timezone</Label>
        <Input
          id="nt-timezone"
          list="tz-options"
          value={nutrition.timezone ?? ""}
          onChange={(e) => setNutrition((prev) => ({ ...prev, timezone: e.target.value || null }))}
          aria-invalid={!!tzError}
          placeholder="e.g. Europe/Zurich"
        />
        <datalist id="tz-options">
          {TIMEZONES.map((tz) => <option key={tz} value={tz} />)}
        </datalist>
        {tzError && <p className="text-xs text-ink">{tzError}</p>}
        <p className="text-xs text-g4">Used for day boundaries (when &quot;today&quot; rolls over).</p>
      </div>

      <Button
        onClick={saveNutritionTargets}
        disabled={updateNutritionTargets.isPending || hasNutritionErrors}
        className="mt-5 w-full"
        size="lg"
      >
        {updateNutritionTargets.isPending ? "Saving..." : "Save targets"}
      </Button>
    </SettingsSection>
  );
}
