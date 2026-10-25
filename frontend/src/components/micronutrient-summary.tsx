"use client";

import { useState } from "react";
import type { MicronutrientAverages, MicronutrientTargetItem } from "@/lib/types";
import { SectionCard } from "@/components/charts/section-card";
import { MicroBar, StatusWord, microHeadline, microStatus, sortByStatus } from "@/components/statistics/micro-status";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNutrientSources } from "@/hooks/queries";
import { getErrorMessage } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { useTracked } from "@/hooks/use-tracked";

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
  const { shows } = useTracked();
  const nutrients = NUTRIENT_MAP.filter((n) => shows(n.key));

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

  if (nutrients.length === 0) return null;

  const rows = sortByStatus(nutrients.map((n) => {
    const value = microAvg[n.key];
    const userTarget = microTargets.find((t) => t.nutrient === n.settingsKey);
    const target = userTarget?.target_value ?? n.defaultTarget;
    return { n, value, target, unit: userTarget?.unit ?? n.defaultUnit, status: microStatus(n.key, value, target) };
  }));

  return (
    <SectionCard title={microHeadline(rows.map((r) => r.status))} summary="daily average">
      <ul className="grid border-t border-g2 md:grid-cols-2 md:gap-x-8">
        {rows.map(({ n, value, target, unit, status }) => {
          const displayVal = value != null ? (Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 10) / 10) : "\u2014";
          const pct = value != null && target > 0 ? Math.round((value / target) * 100) : 0;

          return (
            <li key={n.key} className="border-b border-g2">
              <button
                type="button"
                onClick={() => openSources(n.key, n.label, unit)}
                className="block min-h-[60px] w-full py-3 text-left transition-colors hover:bg-g1"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px] text-ink">{n.label}</span>
                  <span className="whitespace-nowrap tabular-nums">
                    <span className="text-[15px] font-medium text-ink">{displayVal}</span>
                    <span className="ml-1 text-[12px] text-g4">/ {target} {unit}</span>
                    <span className="ml-2 inline-block min-w-[3.25rem] text-right text-[12px]"><StatusWord status={status} />{status !== "none" && <span className="ml-1 text-g4">{pct}%</span>}</span>
                  </span>
                </span>
                <MicroBar className="mt-2.5" value={value} target={target} status={status} />
              </button>
            </li>
          );
        })}
      </ul>

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
                  <div key={i} className="h-14 rounded-sm bg-g2 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                ))}
              </div>
            ) : sources.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No sources found for this period</p>
            ) : (
              <div className="py-1">
                {sources.map((s, i) => {
                  const pct = sourcesTotal > 0 ? (s.amount / sourcesTotal) * 100 : 0;
                  const isSupplement = s.meal_type === "supplement";
                  const dateLabel = new Date(s.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                  return (
                    <div
                      key={i}
                      className="border-b border-g2 py-3"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                                                        <span className="text-sm text-foreground truncate">{s.food_name}</span>
                          </div>
                          <p className="text-[12px] text-g4 mt-0.5">{dateLabel} · {s.meal_type}</p>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-foreground shrink-0">
                          {fmt(s.amount)} {selectedNutrient?.unit}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="h-[3px] flex-1 bg-g2">
                          <div
                            className="animate-bar h-full"
                            style={{ width: `${pct}%`, background: isSupplement ? "var(--g5)" : "var(--ink)" }}
                          />
                        </div>
                        <span className="text-[12px] text-g4 tabular-nums min-w-[28px] text-right">{Math.round(pct)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
