import { fmt } from "@/lib/utils";
import { fmtDateFull } from "@/lib/chart-utils";
import { CHART_TOOLTIP_BG, CHART_TOOLTIP_BORDER, CHART_TOOLTIP_FG } from "@/lib/chart-theme";

export const TT_STYLE: React.CSSProperties = {
  backgroundColor: CHART_TOOLTIP_BG,
  border: `1px solid ${CHART_TOOLTIP_BORDER}`,
  color: CHART_TOOLTIP_FG,
  padding: 12,
  borderRadius: 10,
  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  fontSize: 12,
};

export function ChartTooltip({ active, payload, label, valueSuffix = "", valueKey }: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color?: string }>;
  label?: string;
  valueSuffix?: string;
  valueKey?: string;
}) {
  if (!active || !payload?.length) return null;
  const item = valueKey ? payload.find(p => p.dataKey === valueKey) ?? payload[0] : payload[0];
  return (
    <div style={TT_STYLE}>
      <p style={{ color: "#999", fontSize: 11, marginBottom: 4 }}>{fmtDateFull(label ?? "")}</p>
      <p style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>
        {typeof item.value === "number" ? fmt(item.value) : "--"}{valueSuffix}
      </p>
    </div>
  );
}

export function MultiLineTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color?: string; name?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TT_STYLE}>
      <p style={{ color: "#999", fontSize: 11, marginBottom: 6 }}>{fmtDateFull(label ?? "")}</p>
      {payload.filter(p => typeof p.value === "number").map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: p.color }} />
          <span style={{ color: "#ccc", fontSize: 12 }}>{p.name ?? p.dataKey}:</span>
          <span style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>
            {fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
