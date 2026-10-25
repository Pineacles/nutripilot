"use client";

import { useId, useState } from "react";
import type { RowStatus } from "./metrics";

const STATUS_WORD: Record<Exclude<RowStatus, "none">, string> = { over: "over", low: "low", high: "high", ok: "on track" };

/** The status word on the right of a row: --alert and semibold when it needs attention, quiet g5 when fine. Never colour alone. */
export function StatusLabel({ status }: { status: RowStatus }) {
  if (status === "none") return null;
  return <span className={`text-[13px] ${status === "ok" ? "text-g5" : "font-semibold text-alert"}`}>{STATUS_WORD[status]}</span>;
}

export interface SparkSeries {
  values: number[];
  ink: string;
}

const SPARK_POINTS = 36;

/** Bucket means, so a year of days is at most 36 points. */
function squeeze(values: number[]): number[] {
  if (values.length <= SPARK_POINTS) return values;
  const size = values.length / SPARK_POINTS;
  return Array.from({ length: SPARK_POINTS }, (_, i) => {
    const slice = values.slice(Math.floor(i * size), Math.max(Math.floor(i * size) + 1, Math.floor((i + 1) * size)));
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/** A 72 by 24 line of the 7-day average in its plate: no axes, the target a 1px g3 rule. Decorative. */
export function Sparkline({ series, target }: { series: SparkSeries[]; target?: number }) {
  const W = 72;
  const H = 24;
  const PAD = 2;
  const lines = series.map((s) => ({ ink: s.ink, values: squeeze(s.values) })).filter((s) => s.values.length > 0);
  if (lines.length === 0) return <span className="block h-6 w-[72px]" aria-hidden="true" />;
  const all = lines.flatMap((l) => l.values);
  const hasTarget = target != null && target > 0;
  const lo = Math.min(0, ...all);
  const hi = Math.max(...all, hasTarget ? target : 0, 1);
  const y = (v: number) => H - PAD - ((v - lo) / (hi - lo || 1)) * (H - PAD * 2);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="block shrink-0">
      {hasTarget && <line x1={0} x2={W} y1={y(target)} y2={y(target)} stroke="var(--g3)" strokeWidth={1} />}
      {lines.map((l, i) => {
        const step = l.values.length > 1 ? (W - PAD * 2) / (l.values.length - 1) : 0;
        const pts = l.values.map((v, j) => `${(PAD + j * step).toFixed(1)},${y(v).toFixed(1)}`);
        if (pts.length === 1) pts.push(`${W - PAD},${y(l.values[0]).toFixed(1)}`);
        return <polyline key={i} points={pts.join(" ")} fill="none" stroke={l.ink} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />;
      })}
    </svg>
  );
}

/** Height and opacity reveal (220ms, like a Today meal row). Always in the tree so it can ease; inert while closed. */
export function Reveal({ open, id, children }: { open: boolean; id?: string; children: React.ReactNode }) {
  return (
    <div
      id={id}
      inert={!open}
      className={`grid transition-[grid-template-rows,opacity] duration-(--dur) ease-(--ease-out) motion-reduce:transition-none ${
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

interface RowProps {
  name: string;
  /** Plate swatches before the name (none for the vitamins). */
  swatches?: string[];
  answer: string;
  status: RowStatus;
  spark?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  /** The expanded detail; mounted the first time the row opens. */
  children: React.ReactNode;
}

/** A ruled scorecard row: name, the answer in words, a sparkline and a status word; a tap opens its detail in place. */
export function ScoreRow({ name, swatches = [], answer, status, spark, open, onToggle, children }: RowProps) {
  const panelId = useId();
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  return (
    <li className={`border-b border-g2 ${open ? "lg:col-span-2" : ""}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={panelId} className="grid min-h-[64px] w-full grid-cols-[1fr_auto_4.25rem] items-center gap-3 py-3 text-left">
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-[17px] font-medium text-ink">
            {swatches.length > 0 && (
              <span className="flex shrink-0 gap-0.5" aria-hidden="true">
                {swatches.map((ink, i) => <span key={i} className="h-2.5 w-2.5" style={{ background: ink }} />)}
              </span>
            )}
            <span className="truncate">{name}</span>
          </span>
          <span className="mt-0.5 block text-[13px] text-g4">{answer}</span>
        </span>
        {spark ?? <span className="block h-6 w-[72px]" aria-hidden="true" />}
        <span className="text-right"><StatusLabel status={status} /></span>
      </button>
      <Reveal open={open} id={panelId}>
        {mounted && <div className="pb-5 pt-1">{children}</div>}
      </Reveal>
    </li>
  );
}

/** A ruled group: a small heading with its plate swatches, then the rows in one column, two from 1024px. */
export function ScoreGroup({ title, swatches = ["var(--ink)"], children }: { title: string; swatches?: string[]; children: React.ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <div className="mb-1 flex items-center gap-3">
        <span className="flex gap-0.5" aria-hidden="true">
          {swatches.map((ink, i) => <span key={i} className="h-3 w-3" style={{ background: ink }} />)}
        </span>
        <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
      </div>
      <ul className="grid border-t border-g2 lg:grid-cols-2 lg:gap-x-10">{children}</ul>
    </section>
  );
}
