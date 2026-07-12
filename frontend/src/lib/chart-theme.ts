/**
 * Chart color/style tokens shared by the statistics and body-composition pages.
 *
 * These are plain `var(--x)` strings — recharts (and SVG in general) resolve
 * CSS custom properties in presentation-attribute values (stroke, fill, etc.)
 * exactly like any other CSS color, so passing these strings straight into
 * recharts props renders identically to the old hardcoded hex values, but the
 * actual color now lives in one place (globals.css `:root`).
 *
 */

export const CHART_GRID_DASH = "3 3";

// The statistics page originally used a subtle translucent-white grid line;
// the body page used a solid dark one. Kept distinct on purpose — unifying
// them would be a (forbidden) visual change.
export const CHART_GRID_SUBTLE = "var(--chart-grid-subtle)";
export const CHART_GRID_SOLID = "var(--chart-grid-solid)";

export const CHART_TICK_X = { fill: "var(--chart-tick-x)", fontSize: 10 } as const;
export const CHART_TICK_Y = { fill: "var(--chart-tick-y)", fontSize: 11 } as const;

export const CHART_TOOLTIP_BG = "var(--chart-tooltip-bg)";
export const CHART_TOOLTIP_BORDER = "var(--chart-tooltip-border)";
export const CHART_TOOLTIP_FG = "var(--chart-tooltip-fg)";

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
