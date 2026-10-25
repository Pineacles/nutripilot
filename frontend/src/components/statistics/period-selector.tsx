"use client";

import { useState } from "react";

const PRESETS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y", days: 365 },
];

interface Props {
  activePreset: number;
  onPreset: (days: number) => void;
  customFrom: string;
  customTo: string;
  onCustomFrom: (v: string) => void;
  onCustomTo: (v: string) => void;
  onApplyCustomRange: () => void;
}

const FIELD = "h-11 min-w-0 rounded-[14px] border border-g3 bg-transparent px-3 text-[13px] text-ink focus:border-ink focus:outline-none [color-scheme:dark]";

export function PeriodSelector({ activePreset, onPreset, customFrom, customTo, onCustomFrom, onCustomTo, onApplyCustomRange }: Props) {
  const [open, setOpen] = useState(false);
  const showCustom = open || activePreset === 0;
  const canApply = !!customFrom && !!customTo;
  return (
    <div className="mb-6">
      <div role="group" aria-label="Period" className="grid grid-cols-4 gap-2 sm:flex">
        {PRESETS.map((p) => (
          <button
            key={p.days}
            type="button"
            aria-pressed={activePreset === p.days}
            onClick={() => onPreset(p.days)}
            className={`h-11 rounded-full border text-[13px] font-medium tabular-nums transition-colors duration-150 sm:min-w-16 sm:px-4 ${
              activePreset === p.days
                ? "border-ink bg-ink text-g0"
                : "border-g3 text-g5 hover:border-g5 hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-expanded={showCustom}
        onClick={() => setOpen((o) => !o)}
        className="mt-1 flex h-11 items-center gap-1 text-[13px] text-g5 transition-colors hover:text-ink"
      >
        Custom range
        <svg className={`h-4 w-4 transition-transform duration-150 ${showCustom ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {showCustom && (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <input type="date" aria-label="From" value={customFrom} onChange={(e) => onCustomFrom(e.target.value)} className={FIELD} />
          <input type="date" aria-label="To" value={customTo} onChange={(e) => onCustomTo(e.target.value)} className={FIELD} />
          <button
            type="button"
            onClick={onApplyCustomRange}
            disabled={!canApply}
            className="col-span-2 h-11 rounded-full border border-g3 px-5 text-[13px] text-ink transition-colors hover:border-g5 disabled:text-g4 disabled:hover:border-g3 sm:col-span-1"
          >
            Apply range
          </button>
        </div>
      )}
    </div>
  );
}
