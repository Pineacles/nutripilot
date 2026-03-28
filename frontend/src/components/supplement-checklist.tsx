"use client";

import type { SupplementEntry, SupplementDefinition, MicronutrientTargetItem } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";

const MICRO_LABELS: Record<string, string> = {
  vitamin_d: "vitamin D",
  zinc: "zinc",
  omega3: "omega-3",
  iron: "iron",
  calcium: "calcium",
  magnesium: "magnesium",
  b12: "B12",
  vit_c: "vitamin C",
  creatine: "creatine",
  fiber: "fiber",
  potassium: "potassium",
};

interface Props {
  supplements: SupplementEntry[];
  definitions?: SupplementDefinition[];
  microTargets?: MicronutrientTargetItem[];
}

export function SupplementsCard({ supplements, definitions = [], microTargets = [] }: Props) {
  function getMicroContributions(name: string) {
    const def = definitions.find(
      (d) => d.name.toLowerCase() === name.toLowerCase() && d.micronutrients
    );
    if (!def || !def.micronutrients) return null;

    return Object.entries(def.micronutrients).map(([key, value]) => {
      const target = microTargets.find((t) => t.nutrient === key);
      const label = MICRO_LABELS[key] || key;
      const pct = target ? Math.round((value / target.target_value) * 100) : null;
      const unit = target?.unit || "";
      return { label, value, unit, pct };
    });
  }

  return (
    <DashboardCard title="Supplements" className="col-span-1">
      {supplements.length === 0 ? (
        <p className="text-sm text-white/30">No supplements today</p>
      ) : (
        <div className="space-y-3">
          {supplements.map((s, i) => {
            const contributions = getMicroContributions(s.name);
            return (
              <div key={i}>
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-md border border-[#22c55e]/40 bg-[#22c55e]/10 flex items-center justify-center shrink-0">
                    <svg
                      className="h-3 w-3 text-[#22c55e]"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80 truncate">{s.name}</p>
                    <p className="text-xs text-white/30">
                      {s.dose_amount} {s.dose_unit}
                      {s.time_of_day && ` · ${s.time_of_day}`}
                    </p>
                  </div>
                </div>
                {contributions && contributions.length > 0 && (
                  <div className="ml-8 mt-1 space-y-0.5">
                    {contributions.map((c) => (
                      <p key={c.label} className="text-[10px] text-white/25">
                        → contributes {c.value} {c.unit} {c.label}
                        {c.pct != null && (
                          <span className="text-[#22c55e]/60"> ({c.pct}% of target)</span>
                        )}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
