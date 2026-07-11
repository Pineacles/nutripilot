"use client";

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

export function PeriodSelector({ activePreset, onPreset, customFrom, customTo, onCustomFrom, onCustomTo, onApplyCustomRange }: Props) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 -mt-4">
      <p className="text-sm text-muted-foreground">Track weight, body fat, and muscle trends</p>
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.days}
            onClick={() => onPreset(p.days)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 ${
              activePreset === p.days
                ? "pill-green text-primary"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="flex items-center gap-1.5 ml-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomFrom(e.target.value)}
            className="bg-secondary text-foreground text-xs rounded-lg px-2 py-1.5 border border-border"
          />
          <span className="text-muted-foreground text-xs">to</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => onCustomTo(e.target.value)}
            className="bg-secondary text-foreground text-xs rounded-lg px-2 py-1.5 border border-border"
          />
          <button
            onClick={onApplyCustomRange}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            Go
          </button>
        </div>
      </div>
    </div>
  );
}
