"use client";

import type { SupplementEntry, SupplementDefinition, MicronutrientTargetItem } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";
import { Badge } from "@/components/ui/badge";

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
        <p className="text-sm text-muted-foreground">No supplements today</p>
      ) : (
        <div className="space-y-4">
          {supplements.map((s, i) => {
            const contributions = getMicroContributions(s.name);
            return (
              <div key={i} className="group">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-md border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0">
                    <svg
                      className="h-3 w-3 text-primary"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-foreground/90 truncate">{s.name}</p>
                      {s.time_of_day && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {s.time_of_day}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {s.dose_amount} {s.dose_unit}
                    </p>
                  </div>
                </div>
                {contributions && contributions.length > 0 && (
                  <div className="ml-8 mt-1.5 space-y-0.5">
                    {contributions.map((c) => (
                      <p key={c.label} className="text-[10px] text-muted-foreground/50">
                        contributes {c.value} {c.unit} {c.label}
                        {c.pct != null && (
                          <span className="text-primary/60"> ({c.pct}% of target)</span>
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
