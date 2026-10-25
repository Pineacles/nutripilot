/**
 * Chart color/style tokens shared by the statistics and body-composition pages.
 *
 * These are plain `var(--x)` strings; recharts (and SVG in general) resolve
 * CSS custom properties in presentation-attribute values (stroke, fill, etc.)
 * exactly like any other CSS color, so passing these strings straight into
 * recharts props renders identically to the old hardcoded hex values, but the
 * actual color now lives in one place (globals.css `:root`).
 *
 */

export const CHART_GRID_DASH = "3 3";

// The statistics page originally used a subtle translucent-white grid line;
// the body page used a solid dark one. Kept distinct on purpose; unifying
// them would be a (forbidden) visual change.
export const CHART_GRID_SUBTLE = "var(--chart-grid-subtle)";
export const CHART_GRID_SOLID = "var(--chart-grid-solid)";

// Poster world: tick labels are plain 12px g4 text on every axis.
export const CHART_TICK_X = { fill: "var(--g4)", fontSize: 12 } as const;
export const CHART_TICK_Y = { fill: "var(--g4)", fontSize: 12 } as const;

// Tooltips are a flat g1 panel with a g2 edge, no shadow.
export const CHART_TOOLTIP_BG = "var(--g1)";
export const CHART_TOOLTIP_BORDER = "var(--g2)";
export const CHART_TOOLTIP_FG = "var(--ink)";

export const CHART_COLORS = {
  green: "var(--chart-green)",
  greenLight: "var(--chart-green-light)",
  blue: "var(--chart-blue)",
  amber: "var(--chart-amber)",
  red: "var(--chart-red)",
  purple: "var(--chart-purple)",
  pink: "var(--chart-pink)",
  cyan: "var(--chart-cyan)",
  orange: "var(--chart-orange)",
  teal: "var(--chart-teal)",
  caffeine: "var(--chart-caffeine)",
  caffeineDark: "var(--chart-caffeine-dark)",
} as const;

/**
 * The poster palette for chart marks (DESIGN.md). A nutrient's marks wear its plate (`plateOf`);
 * nutrients without a plate (kcal, sugar, sodium, weight) are ink. Past or secondary series step
 * down the neutral ramp. `--alert` marks only a day over a limit or low on a goal, always with a
 * word beside it; `--done` marks only completed things.
 */
export const POSTER = {
  ink: "var(--ink)",
  past: "var(--g4)",
  quiet: "var(--g5)",
  edge: "var(--g3)",
  hairline: "var(--g2)",
  protein: "var(--protein)",
  carbs: "var(--carbs)",
  fat: "var(--fat)",
} as const;

/** Hairline x axis: a 1px g2 rule under the marks, no tick marks, 12px g4 labels. */
export const POSTER_X_AXIS = {
  tick: CHART_TICK_X,
  axisLine: { stroke: "var(--g2)", strokeWidth: 1 },
  tickLine: false,
  tickMargin: 8,
} as const;

/** Value axis with no line: just quiet figures. */
export const POSTER_Y_AXIS = {
  tick: CHART_TICK_Y,
  axisLine: false,
  tickLine: false,
} as const;

/** A target or limit: one 1px g5 rule, never dashed, never coloured; the zone around it is a plate tint. */
export const POSTER_TARGET_LINE = { stroke: "var(--g5)", strokeWidth: 1 } as const;

/** Label for a target rule, set in the same plain 12px g4. */
export function targetLabel(value: string) {
  return { value, fill: "var(--g4)", fontSize: 12, position: "insideTopRight" } as const;
}

/** Crosshair for line charts and highlight for bar charts when a mark is hovered. */
export const POSTER_CURSOR_LINE = { stroke: "var(--g3)", strokeWidth: 1 } as const;
export const POSTER_CURSOR_BAR = { fill: "var(--g1)" } as const;

/** Active (hovered) point on a line: a small ink dot on the ground. */
export const POSTER_ACTIVE_DOT = { r: 4, fill: "var(--ink)", stroke: "var(--g0)", strokeWidth: 2 } as const;

/** Active (hovered) point wearing a plate ink. */
export function activeDotOf(ink: string) {
  return { ...POSTER_ACTIVE_DOT, fill: ink } as const;
}
