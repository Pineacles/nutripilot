import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { SectionCard } from "@/components/charts/section-card";
import { ChartTooltip } from "./chart-tooltip";
import { nthTickFormatter } from "@/lib/chart-utils";
import { CHART_COLORS, CHART_GRID_SUBTLE, CHART_GRID_DASH, CHART_TICK_X, CHART_TICK_Y } from "@/lib/chart-theme";
import type { SupplementLogEntry } from "@/lib/types";

interface Props {
  supplementLog: SupplementLogEntry[];
  days: number;
}

export function SupplementConsistencyCard({ supplementLog, days }: Props) {
  return (
    <SectionCard title="Supplement Consistency" span="lg:col-span-2">
      {supplementLog.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No supplement data</p>
      ) : (() => {
        const daysWithSupps = supplementLog.filter(s => s.count > 0).length;
        const adherencePct = days > 0 ? Math.round((daysWithSupps / days) * 100) : 0;

        // Per-supplement frequency
        const suppFreq: Record<string, number> = {};
        for (const entry of supplementLog) {
          for (const name of entry.names) {
            suppFreq[name] = (suppFreq[name] || 0) + 1;
          }
        }
        const suppList = Object.entries(suppFreq)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count, pct: days > 0 ? Math.round((count / days) * 100) : 0 }));

        return (
          <div className="flex flex-col lg:flex-row gap-5">
            {/* Left: trend chart */}
            <div className="flex-1 min-w-0">
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={supplementLog} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="suppGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.green} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS.green} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray={CHART_GRID_DASH} stroke={CHART_GRID_SUBTLE} vertical={false} />
                  <XAxis dataKey="date" tick={CHART_TICK_X} axisLine={false} tickLine={false}
                    tickFormatter={nthTickFormatter(supplementLog, 5)} />
                  <YAxis tick={CHART_TICK_Y} axisLine={false} tickLine={false} width={25} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip valueSuffix=" supplements" />} />
                  <Area type="monotone" dataKey="count" stroke={CHART_COLORS.green} strokeWidth={2}
                    fill="url(#suppGrad)" dot={false} animationDuration={600} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* Right: per-supplement breakdown */}
            <div className="lg:w-56 shrink-0 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Overall</span>
                <span className="text-xs font-bold text-primary tabular-nums">{adherencePct}%</span>
              </div>
              {suppList.map(s => (
                <div key={s.name}>
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="text-foreground/80 truncate mr-2">{s.name}</span>
                    <span className="text-muted-foreground tabular-nums shrink-0">{s.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${s.pct}%`, background: s.pct >= 80 ? "linear-gradient(90deg, #22c55e, #4ade80)" : s.pct >= 50 ? "linear-gradient(90deg, #f59e0b, #fbbf24)" : "linear-gradient(90deg, #ef4444, #f87171)" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </SectionCard>
  );
}
