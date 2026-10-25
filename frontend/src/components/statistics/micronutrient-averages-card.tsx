"use client";

import { useState } from "react";
import { Reveal, ScoreRow } from "./scorecard-row";
import { MicroBar, StatusWord, microStatus, sortByStatus } from "./micro-status";
import type { RowStatus } from "./metrics";
import { fmtFigure } from "@/lib/chart-utils";
import type { MicronutrientAverages } from "@/lib/types";
import { useTracked } from "@/hooks/use-tracked";

export const MICROS: { key: keyof MicronutrientAverages; label: string; target: number; unit: string }[] = [
  { key: "vit_d", label: "Vitamin D", target: 100, unit: "µg" },
  { key: "zinc", label: "Zinc", target: 15, unit: "mg" },
  { key: "omega3", label: "Omega-3", target: 1000, unit: "mg" },
  { key: "magnesium", label: "Magnesium", target: 400, unit: "mg" },
  { key: "b12", label: "B12", target: 2.4, unit: "µg" },
  { key: "iron", label: "Iron", target: 18, unit: "mg" },
  { key: "calcium", label: "Calcium", target: 1000, unit: "mg" },
  { key: "vit_c", label: "Vitamin C", target: 90, unit: "mg" },
  { key: "potassium", label: "Potassium", target: 3500, unit: "mg" },
];

interface Props {
  microAvg: MicronutrientAverages | null | undefined;
  open: boolean;
  onToggle: () => void;
}

/** One nutrient: name, figure against its target, status word and a 3px bar. */
function MicroItem({ micro, avg, status }: { micro: (typeof MICROS)[number]; avg: number | null | undefined; status: ReturnType<typeof microStatus> }) {
  const pct = avg != null && micro.target > 0 ? Math.round((avg / micro.target) * 100) : 0;
  return (
    <li className="border-b border-g2 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] text-ink">{micro.label}</span>
        <span className="whitespace-nowrap tabular-nums">
          <span className="text-[15px] font-medium text-ink">{avg != null ? fmtFigure(avg) : "no data"}</span>
          <span className="ml-1 text-[12px] text-g4">/ {fmtFigure(micro.target)} {micro.unit}</span>
          <span className="ml-2 inline-block min-w-[3.25rem] text-right text-[12px]"><StatusWord status={status} />{status !== "none" && <span className="ml-1 text-g4">{pct}%</span>}</span>
        </span>
      </div>
      <MicroBar className="mt-2.5" value={avg} target={micro.target} status={status} />
    </li>
  );
}

/**
 * One row for all vitamins and minerals: "2 low, 1 high". Opened, Low and High come first, then a
 * single "6 enough" line that opens the rest.
 */
export function MicroRow({ microAvg, open, onToggle }: Props) {
  const { shows } = useTracked();
  const [showEnough, setShowEnough] = useState(false);
  const micros = MICROS.filter((m) => shows(m.key));
  if (micros.length === 0) return null;
  const rows = sortByStatus(micros.map((micro) => {
    const avg = microAvg?.[micro.key];
    return { micro, avg, status: microStatus(micro.key, avg, micro.target) };
  }));
  const low = rows.filter((r) => r.status === "low");
  const high = rows.filter((r) => r.status === "high");
  const enough = rows.filter((r) => r.status === "enough" || r.status === "none");
  const attention = [...low, ...high];

  const parts = [low.length > 0 && `${low.length} low`, high.length > 0 && `${high.length} high`].filter(Boolean);
  const answer = !microAvg ? "Nothing logged in this period" : parts.length > 0 ? parts.join(", ") : "all enough";
  const status: RowStatus = !microAvg ? "none" : low.length > 0 ? "low" : high.length > 0 ? "high" : "ok";

  return (
    <ScoreRow name={`${micros.length} nutrients`} answer={answer} status={status} open={open} onToggle={onToggle}>
      {!microAvg ? (
        <p className="py-3 text-[13px] text-g4">No micronutrients logged in this period.</p>
      ) : (
        <>
          <p className="mb-2 text-[13px] text-g4">Daily average against target</p>
          {attention.length > 0 && <ul className="border-t border-g2">{attention.map((r) => <MicroItem key={r.micro.key} {...r} />)}</ul>}
          {enough.length > 0 && (
            <>
              <button
                type="button"
                aria-expanded={showEnough}
                onClick={() => setShowEnough((v) => !v)}
                className={`flex min-h-[48px] w-full items-center justify-between text-left text-[15px] text-g5 transition-colors hover:text-ink ${attention.length === 0 ? "border-t border-g2" : ""} border-b border-g2`}
              >
                {enough.length} enough
                <svg className={`h-4 w-4 transition-transform duration-150 ${showEnough ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                </svg>
              </button>
              <Reveal open={showEnough}>
                <ul>{enough.map((r) => <MicroItem key={r.micro.key} {...r} />)}</ul>
              </Reveal>
            </>
          )}
        </>
      )}
    </ScoreRow>
  );
}
