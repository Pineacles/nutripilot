// The plate ink of each nutrient area: the one colour that nutrient wears in every cell, bar,
// chart and source list. Sugar, salt and the vitamins have no plate of their own; they speak in
// status (ink when fine, --alert with a word when over a limit or low on a goal).

const PLATES: Record<string, string> = {
  kcal: "var(--ink)",
  protein: "var(--protein)",
  carbs: "var(--carbs)",
  fat: "var(--fat)",
  fiber: "var(--fiber)",
  water: "var(--water)",
  caffeine: "var(--caffeine)",
  caffeine_mg: "var(--caffeine)",
  alcohol: "var(--alcohol)",
  muscle: "var(--muscle)",
  bodyfat: "var(--bodyfat)",
  body_fat: "var(--bodyfat)",
  weight: "var(--ink)",
};

/** The plate ink for a nutrient key, or ink when it has none. */
export function plateOf(key: string): string {
  return PLATES[key] ?? "var(--ink)";
}

/** A soft fill of a plate (area under a line, a target zone), as one flat colour. */
export function plateTint(key: string, amount = 14): string {
  return `color-mix(in oklab, ${plateOf(key)} ${amount}%, var(--g0))`;
}

export const ALERT = "var(--alert)";
