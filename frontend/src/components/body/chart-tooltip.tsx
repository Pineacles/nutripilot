import { fmt } from "@/lib/utils";
import { fmtDateFull } from "@/lib/chart-utils";
import { BODY_TOOLTIP_STYLE } from "@/lib/body-chart-utils";

export const TT_STYLE: React.CSSProperties = BODY_TOOLTIP_STYLE;

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
      <p style={{ color: "var(--g4)", marginBottom: 2 }}>{fmtDateFull(label ?? "")}</p>
      <p style={{ color: "var(--ink)", fontSize: 15, fontWeight: 500 }}>
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
      <p style={{ color: "var(--g4)", marginBottom: 4 }}>{fmtDateFull(label ?? "")}</p>
      {payload.filter(p => typeof p.value === "number").map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <span style={{ width: 10, height: 2, backgroundColor: p.color }} />
          <span style={{ color: "var(--g5)" }}>{p.name ?? p.dataKey}</span>
          <span style={{ color: "var(--ink)", fontWeight: 500, marginLeft: "auto", paddingLeft: 12 }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}
