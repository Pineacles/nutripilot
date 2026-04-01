"use client";

import { useState } from "react";
import type { MacroTotals, MacroTargets } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";
import { fmt } from "@/lib/utils";

interface SourceItem {
  food_name: string;
  amount: number;
  quantity_g: number;
  date: string;
  meal_type: string;
}

interface Props {
  totals: MacroTotals;
  targets: MacroTargets;
  span?: string;
  dateRange?: { from: string; to: string };
}

// mode: "fill" = more is better (green when hitting target)
// mode: "budget" = less is better (warns when approaching/exceeding limit)
const allMacros = [
  { key: "protein" as const, label: "Protein", gradient: "linear-gradient(90deg, #22c55e, #4ade80)", unit: "g", mode: "fill" as const },
  { key: "carbs" as const, label: "Carbs", gradient: "linear-gradient(90deg, #3b82f6, #60a5fa)", unit: "g", mode: "fill" as const },
  { key: "fat" as const, label: "Fat", gradient: "linear-gradient(90deg, #f59e0b, #fbbf24)", unit: "g", mode: "fill" as const },
  { key: "fiber" as const, label: "Fiber", gradient: "linear-gradient(90deg, #84cc16, #a3e635)", unit: "g", mode: "fill" as const },
  { key: "sugar" as const, label: "Sugar", gradient: "linear-gradient(90deg, #ec4899, #f472b6)", unit: "g", mode: "budget" as const },
  { key: "sodium" as const, label: "Sodium", gradient: "linear-gradient(90deg, #a78bfa, #c4b5fd)", unit: "mg", mode: "budget" as const },
];

export function MacroBreakdownCard({ totals, targets, span, dateRange }: Props) {
  const [selectedMacro, setSelectedMacro] = useState<{ key: string; label: string; unit: string } | null>(null);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [sourcesTotal, setSourcesTotal] = useState(0);
  const [loadingSources, setLoadingSources] = useState(false);

  async function openSources(key: string, label: string, unit: string) {
    setSelectedMacro({ key, label, unit });
    setLoadingSources(true);
    try {
      const fromParam = dateRange?.from || new Date().toISOString().slice(0, 10);
      const toParam = dateRange?.to || new Date().toISOString().slice(0, 10);
      const data = await apiFetch<{ total: number; sources: SourceItem[] }>(
        `/api/dashboard/nutrient-sources?nutrient=${key}&from=${fromParam}&to=${toParam}`
      );
      setSources(data.sources);
      setSourcesTotal(data.total);
    } catch {
      setSources([]);
      setSourcesTotal(0);
    }
    setLoadingSources(false);
  }

  return (
    <DashboardCard title="Macros" span={span}>
      <div className="flex flex-col gap-3 flex-1 justify-center">
        {allMacros.map((m) => {
          const current = Math.round(totals[m.key]);
          const target = Math.round(targets[m.key]);
          const rawPct = target > 0 ? (totals[m.key] / target) * 100 : 0;
          const barPct = Math.min(rawPct, 100);

          let barGradient = m.gradient;
          if (m.mode === "budget" && rawPct > 100) barGradient = "linear-gradient(90deg, #ef4444, #f87171)";
          else if (m.mode === "budget" && rawPct > 80) barGradient = "linear-gradient(90deg, #f59e0b, #fbbf24)";

          const isOver = m.mode === "budget" && rawPct > 100;

          return (
            <button
              key={m.key}
              onClick={() => openSources(m.key, m.label, m.unit)}
              className="group rounded-xl px-3 py-2 -mx-2 transition-all duration-200 hover:bg-muted/40 hover:translate-x-0.5 text-left cursor-pointer w-full"
            >
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors duration-150">{m.label}</span>
                <span className="text-sm tabular-nums text-foreground">
                  <span className={`font-semibold ${isOver ? "text-destructive" : ""}`}>
                    {current}{m.unit}
                  </span>
                  <span className="text-muted-foreground/50"> / {target}{m.unit}</span>
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted/60 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${barPct}%`, background: barGradient }}
                />
              </div>
            </button>
          );
        })}
      </div>

      <Dialog open={!!selectedMacro} onOpenChange={() => setSelectedMacro(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg">{selectedMacro?.label} Sources</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Total: <span className="font-semibold text-foreground">{fmt(sourcesTotal)} {selectedMacro?.unit}</span>
              {dateRange && <span className="ml-2 text-xs text-muted-foreground/60">{dateRange.from === dateRange.to ? dateRange.from : `${dateRange.from} — ${dateRange.to}`}</span>}
            </p>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 -mx-1 px-1 thin-scrollbar">
            {loadingSources ? (
              <div className="space-y-2 py-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-14 rounded-lg bg-muted/30 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                ))}
              </div>
            ) : sources.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No sources found for this period</p>
            ) : (
              <div className="space-y-1.5 py-2">
                {sources.map((s, i) => {
                  const pct = sourcesTotal > 0 ? (s.amount / sourcesTotal) * 100 : 0;
                  const dateLabel = new Date(s.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                  return (
                    <div
                      key={i}
                      className="pill rounded-lg p-3 transition-all duration-200 hover:bg-muted/30"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-sm text-foreground truncate block">{s.food_name}</span>
                          <p className="text-[10px] text-muted-foreground/50 mt-0.5">{dateLabel} · {s.meal_type} · {fmt(s.quantity_g, 0)}g</p>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-foreground shrink-0">
                          {fmt(s.amount)} {selectedMacro?.unit}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="h-1.5 flex-1 rounded-full bg-muted/40 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${pct}%`, background: "linear-gradient(90deg, #22c55e, #4ade80)" }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums min-w-[28px] text-right">{Math.round(pct)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardCard>
  );
}
