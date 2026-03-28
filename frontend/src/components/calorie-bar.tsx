"use client";

interface Props {
  current: number;
  target: number;
}

export function CalorieBar({ current, target }: Props) {
  const pct = Math.min((current / target) * 100, 110);
  const color =
    pct > 100 ? "#f94f4f" : pct > 90 ? "#f9c74f" : "#4ade80";

  return (
    <div className="rounded-xl border border-[#2a2a30] bg-[#1a1a1f] p-4">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm text-[#888]">Calories</span>
        <span className="text-sm tabular-nums">
          <span className="font-semibold">{Math.round(current)}</span>
          <span className="text-[#888]"> / {Math.round(target)} kcal</span>
        </span>
      </div>
      <div className="h-3 w-full rounded-full bg-[#2a2a30] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
