"use client";

import { toast } from "sonner";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTracked, useUpdateTrackedNutrients } from "@/hooks/use-tracked";
import { plateOf } from "@/lib/plates";
import { NUTRIENT_GROUPS, PRESETS, TRACKABLE } from "@/lib/nutrients";
import { getErrorMessage } from "@/lib/api";
import { SettingsSection } from "./section";

/** What Today shows under each preset, so the consequence is clear before choosing it. */
const PRESET_NOTES: Record<string, string> = {
  Everything: "Calories, every macro, vitamins and minerals, and drinks.",
  "Macros only": "Calories, macros, fiber, sugar and drinks. No vitamins or minerals.",
  "Calories and protein": "Only calories and protein. Everything else is hidden.",
};

/** The long group sits behind a disclosure row, closed until asked for. */
const COLLAPSIBLE_GROUP = "Vitamins and minerals";

/** Settings, Tracked nutrients: a switch per nutrient. Hidden ones leave every screen; their data stays. */
// Nutrients with a plate ink; the swatch teaches the colour code. The rest have none.
const PLATED = new Set(["protein", "carbs", "fat", "fiber", "water", "caffeine", "alcohol"]);

export function TrackedNutrientsSection() {
  const { hidden } = useTracked();
  const update = useUpdateTrackedNutrients();
  // The row that just changed flashes once (n re-mounts it so a second toggle flashes again).
  const [lit, setLit] = useState<{ key: string; n: number } | null>(null);

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());

  function save(next: string[], key?: string) {
    update.mutate(next, { onError: (err) => toast.error(getErrorMessage(err, "Couldn't save, try again.")) });
    if (key) setLit((l) => ({ key, n: (l?.n ?? 0) + 1 }));
  }

  function toggle(key: string) {
    save(hidden.has(key) ? [...hidden].filter((k) => k !== key) : [...hidden, key], key);
  }

  const activePreset = PRESETS.find(
    (p) => p.hidden.length === hidden.size && p.hidden.every((k) => hidden.has(k)),
  )?.label;
  const shownCount = TRACKABLE.filter((t) => !hidden.has(t.key)).length;

  return (
    <SettingsSection
      title="Tracked nutrients"
      description="Turn off what you don't want to see. Calories always stay. Hidden values are still saved, so turning one back on shows its full history."
      className="md:col-span-2"
    >
      <div role="radiogroup" aria-label="Presets" className="md:grid md:grid-cols-3 md:gap-x-6">
        {PRESETS.map((p) => {
          const on = activePreset === p.label;
          return (
            <button
              key={p.label}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => save(p.hidden)}
              className="flex min-h-[60px] w-full items-center gap-3 border-t border-g2 py-3 text-left transition-colors duration-[var(--dur-fast)] hover:bg-g1 md:hover:bg-transparent"
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
      <p className="border-t border-g2 pt-3 pb-1 text-xs text-g4 tabular-nums" aria-live="polite">
        {activePreset ? `${activePreset}: ` : "Custom: "}
        {shownCount} of {TRACKABLE.length} nutrients shown, plus calories.
      </p>

      <div className="mt-4 grid gap-6 md:items-start md:grid-cols-3">
        {NUTRIENT_GROUPS.map((group) => {
          const items = TRACKABLE.filter((t) => t.group === group);
          const collapsible = group === COLLAPSIBLE_GROUP;
          const open = !collapsible || openGroups.has(group);
          const listId = `tracked-${group.replace(/\s+/g, "-").toLowerCase()}`;
          return (
            <fieldset key={group}>
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
                    className="flex min-h-[52px] w-full items-center justify-between gap-3 border-t border-g2 text-left transition-colors duration-[var(--dur-fast)] hover:bg-g1 md:hover:bg-transparent"
                  >
                    <span className="text-[15px] text-ink">{group}</span>
                    <span className="flex items-center gap-2 text-xs text-g4 tabular-nums">
                      {items.filter((t) => !hidden.has(t.key)).length} of {items.length} shown
                      <ChevronDown
                        aria-hidden="true"
                        className={`h-4 w-4 transition-transform duration-[var(--dur-fast)] motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
                      />
                    </span>
                  </button>
                </>
              ) : (
                <legend className="mb-1 text-xs text-g4">{group}</legend>
              )}
              {open && (
                <ul id={listId}>
                  {items.map((t) => {
                    const on = !hidden.has(t.key);
                    const flash = lit?.key === t.key;
                    return (
                      <li key={flash ? `${t.key}-${lit.n}` : t.key} className={`border-t border-g2 ${flash ? "animate-lit" : ""}`}>
                        <label className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-2.5">
                            {PLATED.has(t.key) && <span aria-hidden="true" className="inline-block size-[10px] shrink-0" style={{ background: plateOf(t.key) }} />}
                            <span className={`text-[15px] ${on ? "text-ink" : "text-g4"}`}>{t.label}</span>
                          </span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={on}
                            aria-label={`Show ${t.label}`}
                            onClick={() => toggle(t.key)}
                            className="flex h-11 w-14 shrink-0 items-center justify-end"
                          >
                            <span
                              className={`relative block h-6 w-10 rounded-full transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] motion-reduce:transition-none ${
                                on ? "bg-ink" : "bg-g2"
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full transition-[transform,background-color] duration-[var(--dur)] ease-[var(--ease-out)] motion-reduce:transition-none ${
                                  on ? "translate-x-4 bg-g0" : "bg-g4"
                                }`}
                              />
                            </span>
                          </button>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </fieldset>
          );
        })}
      </div>
    </SettingsSection>
  );
}
