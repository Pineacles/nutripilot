"use client";

/* ── Color constants ── */
const COLOR_SUCCESS = "#4ade80";
const COLOR_WARNING = "#f9c74f";
const COLOR_DANGER  = "#f94f4f";

interface Props {
  current: number;
  target: number;
}

function getBarGradient(pct: number): string {
  if (pct > 100) return "linear-gradient(90deg, #ef4444, #f87171)";
  if (pct > 90)  return "linear-gradient(90deg, #f59e0b, #fbbf24)";
  return "linear-gradient(90deg, #22c55e, #4ade80)";
}

export function CalorieBar({ current, target }: Props) {
  const pct = Math.min((current / target) * 100, 110);
  const gradient = getBarGradient(pct);

  return (
    <div className="clay-card p-4">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm text-muted-foreground">Calories</span>
        <span className="text-sm tabular-nums">
          <span className="font-semibold text-foreground">{Math.round(current)}</span>
          <span className="text-muted-foreground"> / {Math.round(target)} kcal</span>
        </span>
      </div>
      <div className="h-3 w-full rounded-full bg-muted/60 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.min(pct, 100)}%`, background: gradient }}
        />
      </div>
    </div>
  );
}
