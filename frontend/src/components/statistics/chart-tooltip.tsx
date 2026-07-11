import { fmt } from "@/lib/utils";
import { fmtDateFull } from "@/lib/chart-utils";
import { CHART_TOOLTIP_BG, CHART_TOOLTIP_BORDER, CHART_TOOLTIP_FG, CHART_TICK_Y } from "@/lib/chart-theme";

export const TT_STYLE: React.CSSProperties = {
  backgroundColor: CHART_TOOLTIP_BG,
  border: `1px solid ${CHART_TOOLTIP_BORDER}`,
  borderRadius: 10,
  color: CHART_TOOLTIP_FG,
  fontSize: 13,
  padding: "10px 14px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
};
const TT_LABEL_STYLE: React.CSSProperties = { color: CHART_TICK_Y.fill, fontSize: 11, marginBottom: 4 };
const TT_ITEM_STYLE: React.CSSProperties = { color: CHART_TOOLTIP_FG, fontSize: 13 };

export function ChartTooltip({ active, payload, label, valueSuffix = "" }: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color?: string; name?: string }>;
  label?: string;
  valueSuffix?: string;
}) {
  if (!active || !payload?.length) return null;
  // Filter out raw data entries when rolling average is present
  const filtered = payload.filter(p => !p.dataKey.startsWith("avg_") || true);
  return (
    <div style={TT_STYLE}>
      <p style={TT_LABEL_STYLE}>{fmtDateFull(label ?? "")}</p>
      {filtered.map((p, i) => {
        // Skip raw data keys when we have the avg counterpart
        if (filtered.some(f => f.dataKey === `avg_${p.dataKey}`)) return null;
        return (
          <p key={i} style={{ ...TT_ITEM_STYLE, fontWeight: 700, marginBottom: 2 }}>
            {p.name ?? p.dataKey}: {typeof p.value === "number" ? fmt(p.value) : p.value}{valueSuffix}
          </p>
        );
      })}
    </div>
  );
}

export function MultiLineTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color?: string; name?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  // Show rolling avg entries; skip raw entries that have a corresponding avg
  const visible = payload.filter(p => {
    if (payload.some(other => other.dataKey === `avg_${p.dataKey}`)) return false;
    return true;
  });
  return (
    <div style={TT_STYLE}>
      <p style={TT_LABEL_STYLE}>{fmtDateFull(label ?? "")}</p>
      {visible.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: p.color }} />
          <span style={{ ...TT_ITEM_STYLE, color: "#ccc" }}>{(p.name ?? p.dataKey).replace(/^avg_/, "")}:</span>
          <span style={{ ...TT_ITEM_STYLE, fontWeight: 600 }}>
            {typeof p.value === "number" ? fmt(p.value) : "--"}
          </span>
        </div>
      ))}
    </div>
  );
}
