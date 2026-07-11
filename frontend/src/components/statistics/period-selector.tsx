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
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <div className="flex gap-1.5">
        {PRESETS.map(p => (
          <button
            key={p.days}
            onClick={() => onPreset(p.days)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
              activePreset === p.days
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="h-5 w-px bg-border mx-1 hidden sm:block" />
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={customFrom}
          onChange={e => onCustomFrom(e.target.value)}
          className="bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <input
          type="date"
          value={customTo}
          onChange={e => onCustomTo(e.target.value)}
          className="bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={onApplyCustomRange}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
