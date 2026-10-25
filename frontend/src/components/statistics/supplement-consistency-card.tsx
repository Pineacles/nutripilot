"use client";

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { SectionCard, SectionEmpty } from "@/components/charts/section-card";
import { ChartTooltip } from "./chart-tooltip";
import { AXIS_TICK_PROPS, dateTickFormatter, useChartMotion } from "@/lib/chart-utils";
import { POSTER_ACTIVE_DOT, POSTER_CURSOR_LINE, POSTER_X_AXIS, POSTER_Y_AXIS } from "@/lib/chart-theme";
import type { SupplementLogEntry } from "@/lib/types";

interface Props {
  supplementLog: SupplementLogEntry[];
  days: number;
}

export function SupplementConsistencyCard({ supplementLog, days }: Props) {
  const motion = useChartMotion();
  const daysWithSupps = supplementLog.filter((s) => s.count > 0).length;
  const adherencePct = days > 0 ? Math.round((daysWithSupps / days) * 100) : 0;

  // Per-supplement frequency
  const suppFreq: Record<string, number> = {};
  for (const entry of supplementLog) {
    for (const name of entry.names) suppFreq[name] = (suppFreq[name] || 0) + 1;
  }
  const suppList = Object.entries(suppFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count, pct: days > 0 ? Math.min(100, Math.round((count / days) * 100)) : 0 }));

  return (
    <SectionCard title={supplementLog.length > 0 ? `Supplements: taken on ${adherencePct}% of days` : "Supplements"}>
      {supplementLog.length === 0 ? (
        <SectionEmpty>No supplements taken in this period.</SectionEmpty>
      ) : (
        <>
          <ResponsiveContainer minWidth={0} width="100%" height={120}>
            <LineChart data={supplementLog} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
              <XAxis dataKey="date" {...POSTER_X_AXIS} tickFormatter={dateTickFormatter()} {...AXIS_TICK_PROPS} />
              <YAxis {...POSTER_Y_AXIS} width={24} allowDecimals={false} />
              <Tooltip content={<ChartTooltip valueSuffix=" taken" />} cursor={POSTER_CURSOR_LINE} />
              <Line type="stepAfter" dataKey="count" stroke="var(--done)" strokeWidth={2} dot={false} activeDot={{ ...POSTER_ACTIVE_DOT, fill: "var(--done)" }} {...motion} />
            </LineChart>
          </ResponsiveContainer>
          <ul className="mt-3 divide-y divide-g2 border-t border-g2">
            {suppList.map((s) => (
              <li key={s.name} className="py-2.5">
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className={`truncate ${s.pct >= 80 ? "text-ink" : "text-g5"}`}>{s.name}</span>
                  <span className="shrink-0 tabular-nums text-g4">{s.pct}%</span>
                </div>
                <div className="mt-2 h-[3px] bg-g2">
                  <div className="animate-bar h-full" style={{ width: `${s.pct}%`, background: s.pct >= 80 ? "var(--done)" : "var(--g5)" }} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </SectionCard>
  );
}
