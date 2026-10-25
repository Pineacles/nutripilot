"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";

const PRESETS = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "60d", days: 60 },
  { label: "90d", days: 90 },
  { label: "180d", days: 180 },
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

const chip =
  "flex h-10 min-w-[48px] items-center justify-center rounded-full border px-4 text-[13px] font-medium transition-colors duration-150 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const chipOff = "border-g3 bg-g0 text-g5 hover:border-g5";
const chipOn = "border-ink bg-ink text-g0";
const dateField =
  "h-11 min-w-0 flex-1 rounded-[14px] border border-g3 bg-transparent px-3 text-[15px] tabular-nums text-ink outline-none focus:border-ink";

export function PeriodSelector({ activePreset, onPreset, customFrom, customTo, onCustomFrom, onCustomTo, onApplyCustomRange }: Props) {
  const [customOpen, setCustomOpen] = useState(false);
  const custom = activePreset === 0;
  const showCustom = customOpen || custom;

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Period">
        {PRESETS.map((p) => (
          <button
            key={p.days}
            type="button"
            onClick={() => onPreset(p.days)}
            aria-pressed={activePreset === p.days}
            className={`${chip} ${activePreset === p.days ? chipOn : chipOff}`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustomOpen((o) => !o)}
          aria-pressed={custom}
          aria-expanded={showCustom}
          className={`${chip} gap-1.5 ${custom ? chipOn : chipOff}`}
        >
          <CalendarRange className="h-4 w-4" aria-hidden="true" />
          Custom
        </button>
      </div>
      {showCustom && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input type="date" aria-label="From" value={customFrom} onChange={(e) => onCustomFrom(e.target.value)} className={dateField} />
          <span className="text-[13px] text-g4">to</span>
          <input type="date" aria-label="To" value={customTo} onChange={(e) => onCustomTo(e.target.value)} className={dateField} />
          <button
            type="button"
            onClick={onApplyCustomRange}
            disabled={!customFrom || !customTo}
            className="h-11 rounded-full border border-g3 px-5 text-[13px] font-medium text-ink transition-colors hover:border-g5 disabled:text-g3 disabled:hover:border-g3"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
