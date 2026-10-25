"use client";

import { useSettings } from "@/hooks/queries";
import { GOAL_BOUNDS } from "@/lib/validation";
import { AutosaveRow, numberParser, type Parsed } from "./autosave-row";
import { nutritionTargetsOf, useSaveNutritionTargets } from "./autosave";

export const TIMEZONES: string[] =
  typeof Intl !== "undefined" && "supportedValuesOf" in Intl
    ? (Intl as unknown as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf("timeZone")
    : [];

const optText = (n: number | null | undefined) => (n == null ? "" : String(n));

function parseTimezone(text: string): Parsed<string | null> {
  const t = text.trim();
  if (t === "") return { value: null };
  if (TIMEZONES.length > 0 && !TIMEZONES.includes(t)) return { error: "Not a recognized timezone, e.g. Europe/Zurich" };
  return { value: t };
}

/** Goal weight, goal body fat and the timezone. All optional, all saved when you leave the field. */
export function GoalsContent() {
  const { data: settings } = useSettings();
  const save = useSaveNutritionTargets();
  const t = nutritionTargetsOf(settings);

  return (
    <div>
      <AutosaveRow<number | null>
        id="goal-weight"
        label="Goal weight"
        value={t.target_weight_kg ?? null}
        toText={optText}
        parse={numberParser(GOAL_BOUNDS.target_weight_kg, true)}
        onSave={(v) => save({ target_weight_kg: v })}
        unit="kg"
        placeholder="No goal"
      />
      <AutosaveRow<number | null>
        id="goal-bodyfat"
        label="Goal body fat"
        value={t.target_body_fat_pct ?? null}
        toText={optText}
        parse={numberParser(GOAL_BOUNDS.target_body_fat_pct, true)}
        onSave={(v) => save({ target_body_fat_pct: v })}
        unit="%"
        placeholder="No goal"
      />
      <AutosaveRow<string | null>
        id="timezone"
        label="Timezone"
        type="text"
        list="tz-options"
        value={t.timezone ?? null}
        toText={(v) => v ?? ""}
        parse={parseTimezone}
        onSave={(v) => save({ timezone: v })}
        placeholder="Europe/Zurich"
      />
      <datalist id="tz-options">
        {TIMEZONES.map((tz) => <option key={tz} value={tz} />)}
      </datalist>
      <p className="border-t border-g2 pt-3 text-xs text-g4">The timezone sets when &quot;today&quot; rolls over.</p>
    </div>
  );
}
