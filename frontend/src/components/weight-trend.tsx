"use client";

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip } from "recharts";
import type { WeightDelta } from "@/lib/types";
import { fmt } from "@/lib/utils";
import { SectionCard, SectionEmpty } from "@/components/charts/section-card";
import { POSTER, POSTER_ACTIVE_DOT, POSTER_CURSOR_LINE, POSTER_TARGET_LINE, POSTER_X_AXIS, POSTER_Y_AXIS } from "@/lib/chart-theme";
import { TT_STYLE } from "@/components/statistics/chart-tooltip";
import { fmtAxisTick, useChartMotion } from "@/lib/chart-utils";

interface Props {
  weight: WeightDelta;
  /** Null/undefined hides the goal reference line entirely (no goal weight set). */
  goalKg?: number | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TT_STYLE}>
      <p style={{ color: "var(--g4)", fontSize: 12 }}>{label}</p>
      <p style={{ fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{typeof payload[0].value === "number" ? fmt(payload[0].value) : payload[0].value} kg</p>
    </div>
  );
}

export function WeightTrendCard({ weight, bodyComp, goalKg = null }: Props & { bodyComp?: { date: string; weight_kg: number }[] }) {
  const motion = useChartMotion();
  // Use real body_comp data if available, otherwise try to derive from weight delta
  const realPoints = bodyComp?.filter((d) => d.weight_kg != null) ?? [];

  if (realPoints.length === 0 && weight.start_kg == null) {
    return (
      <SectionCard title="Weight">
        <SectionEmpty>No weight recorded this week. Add a measurement on the Body page.</SectionEmpty>
      </SectionCard>
    );
  }

  const points = realPoints.length > 0
    ? realPoints.map((d) => ({
        day: new Date(d.date + "T00:00:00").toLocaleDateString("en", { weekday: "short" }),
        weight: d.weight_kg,
      }))
    : (() => {
        // Fallback: interpolate from start/end
        const startKg = weight.start_kg!;
        const endKg = weight.end_kg ?? startKg;
        return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => ({
          day,
          weight: Math.round((startKg + (endKg - startKg) * (i / 6)) * 10) / 10,
        }));
      })();

  const allW = points.map((p) => p.weight);
  const withGoal = goalKg != null ? [...allW, goalKg] : allW;
  const minW = Math.floor(Math.min(...withGoal) - 1);
  const maxW = Math.ceil(Math.max(...withGoal) + 1);

  return (
    <SectionCard title={weight.delta != null ? `Weight: ${weight.delta > 0 ? "+" : ""}${fmt(weight.delta)} kg this week` : "Weight"} summary={[goalKg != null ? `goal ${fmt(goalKg)} kg` : null].filter(Boolean).join(", ") || undefined}>
      {weight.end_kg != null && (
        <p className="-mt-1 mb-3">
          <span className="text-[22px] font-medium tabular-nums text-ink">{fmt(weight.end_kg)}</span>
          <span className="ml-1 text-[12px] text-g4">kg now</span>
        </p>
      )}
      <ResponsiveContainer minWidth={0} width="100%" height={160}>
        <LineChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <XAxis dataKey="day" {...POSTER_X_AXIS} />
          <YAxis {...POSTER_Y_AXIS} domain={[minW, maxW]} width={34} tickFormatter={fmtAxisTick} />
          <Tooltip content={<CustomTooltip />} cursor={POSTER_CURSOR_LINE} />
          {goalKg != null && <ReferenceLine y={goalKg} {...POSTER_TARGET_LINE} />}
          <Line type="monotone" dataKey="weight" stroke={POSTER.ink} strokeWidth={2} dot={{ r: 3, fill: POSTER.ink, strokeWidth: 0 }} activeDot={POSTER_ACTIVE_DOT} {...motion} />
        </LineChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}
