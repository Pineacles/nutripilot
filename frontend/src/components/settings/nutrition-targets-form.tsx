"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useUpdateNutritionTargets } from "@/hooks/queries";
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

const FIELDS = [
  { label: "Daily Calorie Target", key: "target_kcal" as const, unit: "kcal" },
  { label: "Protein Target", key: "target_protein_g" as const, unit: "g" },
  { label: "Carbs Target", key: "target_carbs_g" as const, unit: "g" },
  { label: "Fat Target", key: "target_fat_g" as const, unit: "g" },
  { label: "Fiber Target", key: "target_fiber_g" as const, unit: "g" },
  { label: "Sugar Limit", key: "target_sugar_g" as const, unit: "g" },
  { label: "Sodium Limit", key: "target_sodium_mg" as const, unit: "mg" },
  { label: "Alcohol Limit", key: "target_alcohol_g" as const, unit: "g" },
  { label: "Water Target", key: "target_water_ml" as const, unit: "ml" },
  { label: "Caffeine Limit", key: "target_caffeine_mg" as const, unit: "mg" },
];

interface Props {
  initial: NutritionTargets | undefined;
}

export function NutritionTargetsForm({ initial }: Props) {
  const [nutrition, setNutrition] = useState<NutritionTargets>(DEFAULT_NUTRITION_TARGETS);
  const updateNutritionTargets = useUpdateNutritionTargets();

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
      onSuccess: () => toast.success("Nutrition targets saved"),
    });
  }

  return (
    <div className="clay-card p-5 md:col-span-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Nutrition Targets</h3>
      <div className="space-y-3">
        {FIELDS.map((field) => {
          const bounds = NUTRITION_TARGET_BOUNDS[field.key];
          const fieldError = nutritionErrors[field.key];
          return (
            <div key={field.key} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{field.label}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={nutrition[field.key]}
                  min={bounds.min}
                  max={bounds.max}
                  aria-invalid={!!fieldError}
                  onChange={(e) =>
                    setNutrition((prev) => ({ ...prev, [field.key]: Number(e.target.value) }))
                  }
                  className="flex-1 tabular-nums"
                />
                <span className="text-xs text-muted-foreground w-8">{field.unit}</span>
              </div>
              {fieldError && <p className="text-[11px] text-destructive">{fieldError}</p>}
            </div>
          );
        })}

        <Separator className="my-1" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Goals (optional)</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Goal weight (kg)</Label>
            <Input
              type="number"
              value={nutrition.target_weight_kg ?? ""}
              onChange={(e) => setNutrition((prev) => ({ ...prev, target_weight_kg: e.target.value === "" ? null : Number(e.target.value) }))}
              aria-invalid={!!goalWeightError}
              placeholder="no goal"
              className="tabular-nums"
            />
            {goalWeightError && <p className="text-[11px] text-destructive">{goalWeightError}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Goal body fat (%)</Label>
            <Input
              type="number"
              value={nutrition.target_body_fat_pct ?? ""}
              onChange={(e) => setNutrition((prev) => ({ ...prev, target_body_fat_pct: e.target.value === "" ? null : Number(e.target.value) }))}
              aria-invalid={!!goalBfError}
              placeholder="no goal"
              className="tabular-nums"
            />
            {goalBfError && <p className="text-[11px] text-destructive">{goalBfError}</p>}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Timezone</Label>
          <Input
            list="tz-options"
            value={nutrition.timezone ?? ""}
            onChange={(e) => setNutrition((prev) => ({ ...prev, timezone: e.target.value || null }))}
            aria-invalid={!!tzError}
            placeholder="e.g. Europe/Zurich"
          />
          <datalist id="tz-options">
            {TIMEZONES.map((tz) => <option key={tz} value={tz} />)}
          </datalist>
          {tzError && <p className="text-[11px] text-destructive">{tzError}</p>}
          <p className="text-[10px] text-muted-foreground/60">Used for day boundaries (when &quot;today&quot; rolls over).</p>
        </div>

        <Button
          onClick={saveNutritionTargets}
          disabled={updateNutritionTargets.isPending || hasNutritionErrors}
          className="mt-2 w-full"
          size="lg"
        >
          {updateNutritionTargets.isPending ? "Saving..." : "Save Targets"}
        </Button>
      </div>
    </div>
  );
}
