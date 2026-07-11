import type { StatsSummary } from "@/lib/types";

interface Props {
  data: StatsSummary;
  avgKcal: number;
  targetKcal: number;
  logPct: number;
}

export function HeroStats({ data, avgKcal, targetKcal, logPct }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div className="pill pill-green rounded-xl p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Days Logged</p>
        <p className="text-2xl font-bold tabular-nums text-foreground">{data.days_logged}<span className="text-sm font-normal text-muted-foreground">/{data.total_days}</span></p>
        <p className="text-xs text-emerald-400 font-medium mt-0.5">{logPct}% consistency</p>
      </div>
      <div className="pill pill-blue rounded-xl p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Current Streak</p>
        <p className="text-2xl font-bold tabular-nums text-foreground">{data.current_streak}</p>
        <p className="text-xs text-blue-400 font-medium mt-0.5">consecutive days</p>
      </div>
      <div className="pill pill-amber rounded-xl p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Avg Daily Kcal</p>
        <p className="text-2xl font-bold tabular-nums text-foreground">{avgKcal.toLocaleString()}</p>
        <p className="text-xs text-amber-400 font-medium mt-0.5">target {targetKcal.toLocaleString()}</p>
      </div>
      <div className="pill pill-purple rounded-xl p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Supplements</p>
        <p className="text-2xl font-bold tabular-nums text-foreground">{Math.round(data.supplement_adherence_pct)}%</p>
        <p className="text-xs text-purple-400 font-medium mt-0.5">adherence rate</p>
      </div>
    </div>
  );
}
