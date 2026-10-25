"use client";

import { ScoreRow, Sparkline } from "./scorecard-row";
import type { RowStatus } from "./metrics";
import type { SupplementLogEntry } from "@/lib/types";

interface Props {
  supplementLog: SupplementLogEntry[];
  days: number;
  open: boolean;
  onToggle: () => void;
}

/** The Supplements row: "taken on 80% of days"; opened, each supplement's share of days. Done Green marks the ones taken most days. */
export function SupplementRow({ supplementLog, days, open, onToggle }: Props) {
  const daysWithSupps = supplementLog.filter((s) => s.count > 0).length;
  const adherencePct = days > 0 ? Math.round((daysWithSupps / days) * 100) : 0;

  const suppFreq: Record<string, number> = {};
  for (const entry of supplementLog) {
    for (const name of entry.names) suppFreq[name] = (suppFreq[name] || 0) + 1;
  }
  const suppList = Object.entries(suppFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count, pct: days > 0 ? Math.min(100, Math.round((count / days) * 100)) : 0 }));

  const has = supplementLog.length > 0;
  const status: RowStatus = !has ? "none" : adherencePct >= 80 ? "ok" : adherencePct < 50 ? "low" : "none";
  return (
    <ScoreRow
      name="Supplements"
      swatches={["var(--done)"]}
      answer={has ? `taken on ${adherencePct}% of days` : "None taken in this period"}
      status={status}
      spark={has ? <Sparkline series={[{ values: supplementLog.map((s) => s.count), ink: "var(--done)" }]} /> : undefined}
      open={open}
      onToggle={onToggle}
    >
      {!has ? (
        <p className="py-3 text-[13px] text-g4">No supplements taken in this period.</p>
      ) : (
        <ul className="divide-y divide-g2 border-t border-g2">
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
      )}
    </ScoreRow>
  );
}
