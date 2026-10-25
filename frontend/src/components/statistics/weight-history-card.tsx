"use client";

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";
import { SectionCard, SectionEmpty } from "@/components/charts/section-card";
import { ChartTooltip } from "./chart-tooltip";
import { fmtDateAxis, useChartMotion, AXIS_TICK_PROPS, fmtAxisTick, daysWord } from "@/lib/chart-utils";
import { POSTER, POSTER_ACTIVE_DOT, POSTER_CURSOR_LINE, POSTER_TARGET_LINE, POSTER_X_AXIS, POSTER_Y_AXIS } from "@/lib/chart-theme";
import { fmt } from "@/lib/utils";
import type { BodyCompEntry } from "@/lib/types";

interface Props {
  weightData: BodyCompEntry[];
  targetWeight: number | null;
}

export function WeightHistoryCard({ weightData, targetWeight }: Props) {
  const motion = useChartMotion();
  const latest = [...weightData].reverse().find((d) => d.weight_kg != null)?.weight_kg;
  const withWeight = weightData.filter((d) => d.weight_kg != null);
  let title = "Weight";
  if (withWeight.length >= 2) {
    const first = withWeight[0];
    const end = withWeight[withWeight.length - 1];
    const span = Math.max(1, Math.round((new Date(end.date + "T00:00:00").getTime() - new Date(first.date + "T00:00:00").getTime()) / 86400000));
    const delta = Math.round((end.weight_kg - first.weight_kg) * 10) / 10;
    title = `Weight: ${delta > 0 ? "+" : ""}${fmt(delta)} kg in ${daysWord(span)}`;
  }
  return (
    <SectionCard title={title} summary={[latest != null ? `${fmt(latest)} kg now` : null, targetWeight != null ? `goal ${fmt(targetWeight)} kg` : null].filter(Boolean).join(", ") || undefined}>
      {weightData.length === 0 ? (
        <SectionEmpty>No weight recorded in this period. Add a measurement on the Body page.</SectionEmpty>
      ) : (
        <ResponsiveContainer minWidth={0} width="100%" height={220}>
          <LineChart data={weightData} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <XAxis dataKey="date" {...POSTER_X_AXIS} {...AXIS_TICK_PROPS} tickFormatter={(v: string) => fmtDateAxis(v, weightData.length)} />
            <YAxis {...POSTER_Y_AXIS} width={40} tickFormatter={fmtAxisTick} domain={["auto", "auto"]} />
            <Tooltip content={<ChartTooltip valueSuffix=" kg" />} cursor={POSTER_CURSOR_LINE} />
            {targetWeight != null && (
              <ReferenceLine y={targetWeight} {...POSTER_TARGET_LINE} />
            )}
            <Line type="monotone" dataKey="weight_kg" stroke={POSTER.ink} strokeWidth={2} dot={{ r: 2, fill: POSTER.ink, strokeWidth: 0 }} activeDot={POSTER_ACTIVE_DOT} {...motion} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </SectionCard>
  );
}
