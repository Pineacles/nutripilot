"use client";

import { ScoreRow, Sparkline } from "./scorecard-row";
import { TrendChart, type TargetMode } from "./trend-chart";
import { summarize } from "./metrics";
import { fmtFigure, meanOf } from "@/lib/chart-utils";
import { plateOf } from "@/lib/plates";

export interface Metric {
  key: string;
  name: string;
  /** Plate key for the swatch, the sparkline and the chart (kcal, sugar and sodium have none: ink). */
  plate: string;
  unit: string;
  target: number;
  mode: TargetMode;
  noun: "target" | "limit";
  /** The daily rows with their 7-day average. */
  rows: Record<string, number | string>[];
  rawKey: string;
  avgKey: string;
  /** The days that count (a day with nothing logged does not). */
  counted: number[];
  emptyText: string;
}

/** One single-metric scorecard row; its detail is the 7-day trend chart. */
export function MetricRow({ metric: m, open, onToggle }: { metric: Metric; open: boolean; onToggle: () => void }) {
  const { answer, status } = summarize(m.counted, m.target, m.mode, m.unit, m.noun);
  const avg = meanOf(m.counted);
  const spark = m.rows.length > 0 ? <Sparkline series={[{ values: m.rows.map((d) => Number(d[m.avgKey]) || 0), ink: plateOf(m.plate) }]} target={m.mode === "none" ? undefined : m.target} /> : undefined;
  return (
    <ScoreRow name={m.name} swatches={[plateOf(m.plate)]} answer={answer} status={status} spark={spark} open={open} onToggle={onToggle}>
      {m.rows.length === 0 ? (
        <p className="py-3 text-[13px] text-g4">{m.emptyText}</p>
      ) : (
        <>
          <p className="mb-3 text-[13px] tabular-nums text-g4">
            {avg != null && `7-day average, avg ${fmtFigure(avg)} ${m.unit}`}
            {m.mode !== "none" && m.target > 0 && `, ${m.noun} ${m.target.toLocaleString("en-US")}`}
          </p>
          <TrendChart data={m.rows} rawKey={m.rawKey} avgKey={m.avgKey} plate={m.plate} unit={m.unit} target={m.target} mode={m.mode} height={220} yWidth={36} />
        </>
      )}
    </ScoreRow>
  );
}
