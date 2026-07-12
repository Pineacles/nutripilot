"use client";

import { useState } from "react";
import type { MicronutrientAverages, MicronutrientTargetItem } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNutrientSources } from "@/hooks/queries";
import { getErrorMessage } from "@/lib/api";
import { fmt } from "@/lib/utils";

function getProgressGradient(pct: number): string {
  if (pct >= 80) return "linear-gradient(90deg, #22c55e, #4ade80)";
  if (pct >= 40) return "linear-gradient(90deg, #f59e0b, #fbbf24)";
  return "linear-gradient(90deg, #ef4444, #f87171)";
}

function getProgressColor(pct: number): string {
  if (pct >= 80) return "#4ade80";
  if (pct >= 40) return "#fbbf24";
  return "#f87171";
}

// WHO/RDA recommended daily intake for adults (19-50 years)
const NUTRIENT_MAP: { key: keyof MicronutrientAverages; settingsKey: string; label: string; defaultTarget: number; defaultUnit: string }[] = [
  { key: "vit_d", settingsKey: "vitamin_d", label: "Vitamin D", defaultTarget: 15, defaultUnit: "\u00b5g" },       // WHO/IOM: 15 µg (600 IU)
  { key: "calcium", settingsKey: "calcium", label: "Calcium", defaultTarget: 1000, defaultUnit: "mg" },             // WHO: 1000 mg
  { key: "iron", settingsKey: "iron", label: "Iron", defaultTarget: 18, defaultUnit: "mg" },                         // RDA: 18 mg (women), 8 mg (men): use higher
  { key: "zinc", settingsKey: "zinc", label: "Zinc", defaultTarget: 11, defaultUnit: "mg" },                         // RDA: 11 mg (men), 8 mg (women): use higher
  { key: "magnesium", settingsKey: "magnesium", label: "Magnesium", defaultTarget: 400, defaultUnit: "mg" },         // RDA: 400 mg (men), 310 mg (women)
  { key: "vit_c", settingsKey: "vit_c", label: "Vitamin C", defaultTarget: 90, defaultUnit: "mg" },                  // RDA: 90 mg (men), 75 mg (women)
  { key: "b12", settingsKey: "b12", label: "B12", defaultTarget: 2.4, defaultUnit: "\u00b5g" },                      // RDA: 2.4 µg
  { key: "potassium", settingsKey: "potassium", label: "Potassium", defaultTarget: 2600, defaultUnit: "mg" },        // AI: 2600 mg (women), 3400 mg (men): use middle
  { key: "omega3", settingsKey: "omega3", label: "Omega-3", defaultTarget: 250, defaultUnit: "mg" },                 // WHO: 250 mg EPA+DHA
];

interface Props {
  microAvg: MicronutrientAverages;
  microTargets?: MicronutrientTargetItem[];
  dateRange?: { from: string; to: string };
}

export function MicronutrientSummaryCard({ microAvg, microTargets = [], dateRange }: Props) {
  const [selectedNutrient, setSelectedNutrient] = useState<{ key: string; label: string; unit: string } | null>(null);

  const fromParam = dateRange?.from || new Date().toISOString().slice(0, 10);
  const toParam = dateRange?.to || new Date().toISOString().slice(0, 10);
  const {
    data: sourcesData,
    isFetching: loadingSources,
    isError: sourcesError,
    error: sourcesErrorObj,
  } = useNutrientSources(selectedNutrient?.key ?? null, fromParam, toParam);
  const sources = sourcesData?.sources ?? [];
  const sourcesTotal = sourcesData?.total ?? 0;

  function openSources(key: string, label: string, unit: string) {
    setSelectedNutrient({ key, label, unit });
  }

  return (
    <DashboardCard title="Weekly Micronutrient Goals" span="lg:col-span-2">
      <div className="grid grid-cols-3 gap-3">
        {NUTRIENT_MAP.map((n) => {
          const value = microAvg[n.key];
          const userTarget = microTargets.find((t) => t.nutrient === n.settingsKey);
          const target = userTarget?.target_value ?? n.defaultTarget;
          const unit = userTarget?.unit ?? n.defaultUnit;
          const displayVal = value != null ? Math.round(value * 10) / 10 : "\u2014";
          const pct = value != null && target > 0 ? Math.min((value / target) * 100, 100) : 0;
          const pctRounded = Math.round(pct);

          return (
            <button
              key={n.key}
              onClick={() => openSources(n.key, n.label, unit)}
              className="pill p-4 rounded-xl text-left cursor-pointer transition-all duration-150 hover:ring-1 hover:ring-primary/30 hover:bg-muted/40"
            >
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">{n.label}</p>
              <p className="text-xl font-bold tabular-nums text-foreground">
                {displayVal}
                <span className="text-xs font-normal text-muted-foreground ml-0.5">/ {target} {unit}</span>
              </p>
              <div className="flex items-center gap-2 mt-2">
                <div className="h-2 flex-1 rounded-full overflow-hidden bg-muted/60">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${pct}%`,
                      background: getProgressGradient(pct),
                    }}
                  />
                </div>
                <span
                  className="text-[11px] font-semibold tabular-nums min-w-[32px] text-right"
                  style={{ color: getProgressColor(pct) }}
                >
                  {pctRounded}%
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <Dialog open={!!selectedNutrient} onOpenChange={() => setSelectedNutrient(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg">{selectedNutrient?.label} Sources</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Total: <span className="font-semibold text-foreground">{fmt(sourcesTotal)} {selectedNutrient?.unit}</span>
              {dateRange && <span className="ml-2 text-xs text-muted-foreground/60">{dateRange.from === dateRange.to ? dateRange.from : `${dateRange.from} to ${dateRange.to}`}</span>}
            </p>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 -mx-1 px-1 thin-scrollbar">
            {sourcesError ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{getErrorMessage(sourcesErrorObj, "Couldn't load sources for this period")}</p>
            ) : loadingSources ? (
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
                  const isSupplement = s.meal_type === "supplement";
                  const dateLabel = new Date(s.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                  return (
                    <div
                      key={i}
                      className="pill rounded-lg p-3 transition-all duration-200 hover:bg-muted/30"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {isSupplement && <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0 mt-1" />}
                            <span className="text-sm text-foreground truncate">{s.food_name}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground/50 mt-0.5">{dateLabel} · {s.meal_type}</p>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-foreground shrink-0">
                          {fmt(s.amount)} {selectedNutrient?.unit}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="h-1.5 flex-1 rounded-full bg-muted/40 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${pct}%`, background: isSupplement ? "linear-gradient(90deg, #a78bfa, #c4b5fd)" : "linear-gradient(90deg, #22c55e, #4ade80)" }}
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
