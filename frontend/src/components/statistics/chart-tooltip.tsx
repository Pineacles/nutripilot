import { fmt } from "@/lib/utils";
import { fmtDateFull } from "@/lib/chart-utils";
import { CHART_TOOLTIP_BG, CHART_TOOLTIP_BORDER, CHART_TOOLTIP_FG } from "@/lib/chart-theme";

/** Flat g1 panel with a g2 edge: no shadow, no blur. Also used as recharts `contentStyle`. */
export const TT_STYLE: React.CSSProperties = {
  backgroundColor: CHART_TOOLTIP_BG,
  border: `1px solid ${CHART_TOOLTIP_BORDER}`,
  borderRadius: 14,
  color: CHART_TOOLTIP_FG,
  fontSize: 13,
  padding: "8px 12px",
};
const TT_LABEL_STYLE: React.CSSProperties = { color: "var(--g4)", fontSize: 12, marginBottom: 2 };
const TT_ITEM_STYLE: React.CSSProperties = { color: CHART_TOOLTIP_FG, fontSize: 13, fontVariantNumeric: "tabular-nums" };

type Entry = { value: number; dataKey: string; color?: string; name?: string };

/** Drops raw series that have a rolling-average counterpart, so each metric shows once. */
function visibleEntries(payload: Entry[]) {
  return payload.filter((p) => !payload.some((other) => other.dataKey === `avg_${p.dataKey}`));
}

export function ChartTooltip({ active, payload, label, valueSuffix = "" }: {
  active?: boolean;
  payload?: Entry[];
  label?: string;
  valueSuffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TT_STYLE}>
      <p style={TT_LABEL_STYLE}>{fmtDateFull(label ?? "")}</p>
      {visibleEntries(payload).map((p, i) => (
        <p key={i} style={{ ...TT_ITEM_STYLE, fontWeight: 500 }}>
          {typeof p.value === "number" ? fmt(p.value) : p.value}{valueSuffix}
        </p>
      ))}
    </div>
  );
}

export function MultiLineTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Entry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TT_STYLE}>
      <p style={TT_LABEL_STYLE}>{fmtDateFull(label ?? "")}</p>
      {visibleEntries(payload).map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
          <span style={{ width: 10, height: 2, backgroundColor: p.color }} />
          <span style={{ ...TT_ITEM_STYLE, color: "var(--g5)" }}>{(p.name ?? p.dataKey).replace(/^avg_/, "")}</span>
          <span style={{ ...TT_ITEM_STYLE, fontWeight: 500, marginLeft: "auto", paddingLeft: 8 }}>
            {typeof p.value === "number" ? fmt(p.value) : "--"}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Tooltip for a daily series with a 7-day average: the day's figure, a status word when it broke
 * a limit ("over", in --alert) or fell well short of a goal ("low"), and the average under it.
 */
export function DailyTooltip({ active, payload, label, rawKey, avgKey, unit, limit, goal }: {
  active?: boolean;
  payload?: { payload?: Record<string, number | string> }[];
  label?: string;
  rawKey: string;
  avgKey: string;
  unit: string;
  /** Over this the day is "over". */
  limit?: number;
  /** Under 90% of this the day is "low". */
  goal?: number;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const v = Number(row[rawKey]);
  const avg = Number(row[avgKey]);
  const over = limit != null && limit > 0 && v > limit;
  const low = goal != null && goal > 0 && v < goal * 0.9;
  return (
    <div style={TT_STYLE}>
      <p style={TT_LABEL_STYLE}>{fmtDateFull(label ?? "")}</p>
      <p style={{ ...TT_ITEM_STYLE, fontWeight: 500 }}>
        {fmt(v)} {unit}
        {over && <span style={{ color: "var(--alert)", marginLeft: 8, fontWeight: 600 }}>over</span>}
        {low && <span style={{ color: "var(--alert)", marginLeft: 8, fontWeight: 600 }}>low</span>}
      </p>
      {Number.isFinite(avg) && <p style={{ ...TT_LABEL_STYLE, marginBottom: 0 }}>7-day average {fmt(avg)} {unit}</p>}
    </div>
  );
}
