"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { useSettings } from "@/hooks/queries";
import { useTracked, useUpdateTrackedNutrients } from "@/hooks/use-tracked";
import { plateOf } from "@/lib/plates";
import { NUTRIENT_GROUPS, PRESETS, TRACKABLE, trackableKey } from "@/lib/nutrients";
import { NUTRITION_TARGET_BOUNDS } from "@/lib/validation";
import { getErrorMessage } from "@/lib/api";
import type { NutritionTargets } from "@/lib/types";
import { AutosaveRow, numberParser } from "./autosave-row";
import { microTargetsOf, nutritionTargetsOf, useSaveMicroTarget, useSaveNutritionTargets } from "./autosave";

/** What Today shows under each preset, so the consequence is clear before choosing it. */
const PRESET_NOTES: Record<string, string> = {
  Everything: "Calories, every macro, vitamins and minerals, and drinks.",
  "Macros only": "Calories, macros, fiber, sugar and drinks. No vitamins or minerals.",
  "Calories and protein": "Only calories and protein. Everything else is hidden.",
};

/** The long group sits behind a disclosure row, closed until asked for. */
const COLLAPSIBLE_GROUP = "Vitamins and minerals";

// Nutrients with a plate ink get a swatch; the rest have none.
const PLATED = new Set(["protein", "carbs", "fat", "fiber", "water", "caffeine", "alcohol"]);

type TargetKey = keyof typeof NUTRITION_TARGET_BOUNDS;

/** The daily target field of a nutrient, where it has one, and how its row reads. */
const TARGETS: Record<string, { key: TargetKey; unit: string; label?: string }> = {
  protein: { key: "target_protein_g", unit: "g" },
  carbs: { key: "target_carbs_g", unit: "g" },
  fat: { key: "target_fat_g", unit: "g" },
  fiber: { key: "target_fiber_g", unit: "g" },
  sugar: { key: "target_sugar_g", unit: "g", label: "Sugar limit" },
  salt: { key: "target_sodium_mg", unit: "mg", label: "Sodium limit" },
  water: { key: "target_water_ml", unit: "ml" },
  caffeine: { key: "target_caffeine_mg", unit: "mg", label: "Caffeine limit" },
  alcohol: { key: "target_alcohol_g", unit: "g", label: "Alcohol limit" },
};

const numText = (n: number) => String(n);

/** An on/off switch: 44px target, a 40 by 24 track. */
function Switch({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onToggle} className="flex h-11 w-14 shrink-0 items-center justify-end">
      <span className={`relative block h-6 w-10 rounded-full transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] motion-reduce:transition-none ${on ? "bg-ink" : "bg-g2"}`}>
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full transition-[transform,background-color] duration-[var(--dur)] ease-[var(--ease-out)] motion-reduce:transition-none ${on ? "translate-x-4 bg-g0" : "bg-g4"}`}
        />
      </span>
    </button>
  );
}

/** A row with no target field (saturated fat, a vitamin without a target): name and switch. */
function SwitchRow({ label, swatch, on, onToggle }: { label: string; swatch?: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="border-t border-g2">
      <div className="flex min-h-[60px] items-center gap-3">
        <span className={`flex min-w-0 flex-1 items-center gap-2.5 text-[15px] ${on ? "text-ink" : "text-g4"}`}>
          {swatch && <span aria-hidden="true" className="inline-block size-[10px] shrink-0" style={{ background: swatch }} />}
          <span className="truncate">{label}</span>
        </span>
        <Switch on={on} label={`Show ${label}`} onToggle={onToggle} />
      </div>
    </div>
  );
}

export function NutrientsContent() {
  const { data: settings } = useSettings();
  const { hidden } = useTracked();
  const updateTracked = useUpdateTrackedNutrients();
  const saveTargets = useSaveNutritionTargets();
  const saveMicro = useSaveMicroTarget();
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());

  const targets = nutritionTargetsOf(settings);
  const micro = microTargetsOf(settings);

  function save(next: string[]) {
    updateTracked.mutate(next, { onError: (err) => toast.error(getErrorMessage(err, "Couldn't save, try again.")) });
  }
  function toggle(key: string) {
    save(hidden.has(key) ? [...hidden].filter((k) => k !== key) : [...hidden, key]);
  }

  const activePreset = PRESETS.find((p) => p.hidden.length === hidden.size && p.hidden.every((k) => hidden.has(k)))?.label;

  function numberRow(t: { key: string; label: string }, withSwitch: boolean) {
    const spec = TARGETS[t.key];
    const on = !hidden.has(t.key);
    const label = spec?.label ?? t.label;
    const swatch = PLATED.has(t.key) ? plateOf(t.key) : undefined;
    const trail = withSwitch ? <Switch on={on} label={`Show ${t.label}`} onToggle={() => toggle(t.key)} /> : undefined;
    if (spec) {
      return (
        <AutosaveRow<number>
          key={t.key}
          id={`target-${t.key}`}
          label={label}
          swatch={swatch}
          value={targets[spec.key as keyof NutritionTargets] as number}
          toText={numText}
          parse={numberParser(NUTRITION_TARGET_BOUNDS[spec.key])}
          onSave={(v) => saveTargets({ [spec.key]: v })}
          unit={spec.unit}
          disabled={!on}
          trail={trail}
        />
      );
    }
    // Vitamins and minerals keep their target in the micronutrient list, under the API's own name.
    const m = micro.find((x) => trackableKey(x.nutrient) === t.key);
    if (m) {
      return (
        <AutosaveRow<number>
          key={t.key}
          id={`target-${t.key}`}
          label={label}
          value={m.target_value}
          toText={numText}
          parse={numberParser({ min: 0, max: 100000 })}
          onSave={(v) => saveMicro(m.nutrient, v)}
          unit={m.unit}
          disabled={!on}
          trail={trail}
        />
      );
    }
    return <SwitchRow key={t.key} label={label} swatch={swatch} on={on} onToggle={() => toggle(t.key)} />;
  }

  // Micronutrient targets with no switch of their own (creatine) still belong in the vitamins group.
  const extraMicro = micro.filter((m) => !TRACKABLE.some((t) => t.key === trackableKey(m.nutrient)) && m.nutrient !== "fiber");

  return (
    <div className="space-y-8">
      <div role="radiogroup" aria-label="Presets">
        {PRESETS.map((p) => {
          const on = activePreset === p.label;
          return (
            <button
              key={p.label}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => save(p.hidden)}
              className="flex min-h-[60px] w-full items-center gap-3 border-t border-g2 py-3 text-left transition-colors duration-[var(--dur-fast)] hover:bg-g1"
            >
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-[var(--dur-fast)] ${on ? "border-ink bg-ink" : "border-g3 bg-transparent"}`}
              >
                <span className={`h-2 w-2 rounded-full bg-g0 transition-opacity duration-[var(--dur-fast)] ${on ? "opacity-100" : "opacity-0"}`} />
              </span>
              <span className="min-w-0">
                <span className={`block text-[15px] ${on ? "font-medium text-ink" : "text-g5"}`}>{p.label}</span>
                <span className="block text-xs text-g4">{PRESET_NOTES[p.label]}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div>
        <p className="mb-3 text-[13px] text-g4">
          Set a daily target and turn off what you don&apos;t want to see. Calories always stay. Hidden values are still saved.
        </p>
        {NUTRIENT_GROUPS.slice().sort((a, b) => order(a) - order(b)).map((group) => {
          const items = TRACKABLE.filter((t) => t.group === group);
          const collapsible = group === COLLAPSIBLE_GROUP;
          const open = !collapsible || openGroups.has(group);
          const listId = `tracked-${group.replace(/\s+/g, "-").toLowerCase()}`;
          return (
            <fieldset key={group} className="mb-6 last:mb-0">
              {collapsible ? (
                <>
                  <legend className="sr-only">{group}</legend>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={listId}
                    onClick={() =>
                      setOpenGroups((prev) => {
                        const next = new Set(prev);
                        if (!next.delete(group)) next.add(group);
                        return next;
                      })
                    }
                    className="flex min-h-[60px] w-full items-center justify-between gap-3 border-t border-g2 text-left transition-colors duration-[var(--dur-fast)] hover:bg-g1"
                  >
                    <span className="text-[15px] text-ink">{group}</span>
                    <span className="flex items-center gap-2 text-xs text-g4 tabular-nums">
                      {items.filter((t) => !hidden.has(t.key)).length} of {items.length} shown
                      <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform duration-[var(--dur-fast)] motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
                    </span>
                  </button>
                </>
              ) : (
                <legend className="mb-1 text-xs text-g4">{group}</legend>
              )}
              {open && (
                <div id={listId}>
                  {group === "Macros" && (
                    <AutosaveRow<number>
                      id="target-kcal"
                      label="Calories"
                      value={targets.target_kcal}
                      toText={numText}
                      parse={numberParser(NUTRITION_TARGET_BOUNDS.target_kcal)}
                      onSave={(v) => saveTargets({ target_kcal: v })}
                      unit="kcal"
                    />
                  )}
                  {items.map((t) => numberRow(t, true))}
                  {collapsible &&
                    extraMicro.map((m) => (
                      <AutosaveRow<number>
                        key={m.nutrient}
                        id={`target-${m.nutrient}`}
                        label={MICRO_LABELS[m.nutrient] ?? m.nutrient}
                        value={m.target_value}
                        toText={numText}
                        parse={numberParser({ min: 0, max: 100000 })}
                        onSave={(v) => saveMicro(m.nutrient, v)}
                        unit={m.unit}
                      />
                    ))}
                </div>
              )}
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

const MICRO_LABELS: Record<string, string> = { creatine: "Creatine" };

/** Macros, then Drinks, then Vitamins and minerals (the long one last, behind its disclosure). */
function order(group: string): number {
  return group === "Macros" ? 0 : group === "Drinks" ? 1 : 2;
}
