"use client";

import type { SupplementDefinition, MicronutrientTargetItem } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSupplementLogDay } from "@/hooks/queries";
import { useLogSupplementIntake, useDeleteSupplementLog } from "@/hooks/mutations/supplement-log";
import { getErrorMessage } from "@/lib/api";
import { INTAKE_LOG_TIMINGS } from "@/lib/supplement-constants";
import { toast } from "sonner";

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
  /** Day being viewed on Today — drives the actionable "taken today" state. */
  date: string;
  definitions?: SupplementDefinition[];
  microTargets?: MicronutrientTargetItem[];
}

export function SupplementsCard({ date, definitions = [], microTargets = [] }: Props) {
  const { data: logs = [], isLoading, isError, error, refetch } = useSupplementLogDay(date);
  const logIntake = useLogSupplementIntake();
  const deleteIntake = useDeleteSupplementLog();

  const activeDefs = definitions.filter((d) => d.active);

  function getMicroContributions(def: SupplementDefinition) {
    if (!def.micronutrients) return null;
    return Object.entries(def.micronutrients).map(([key, value]) => {
      const target = microTargets.find((t) => t.nutrient === key);
      const label = MICRO_LABELS[key] || key;
      const pct = target && target.target_value > 0 ? Math.round((value / target.target_value) * 100) : null;
      const unit = target?.unit || "";
      return { label, value, unit, pct };
    });
  }

  function markTaken(def: SupplementDefinition) {
    // Supplement *definitions* allow free-form time_of_day (e.g. "with meal"), but the
    // intake-log endpoint restricts it to morning/afternoon/evening — drop anything else
    // rather than let the request 422.
    const safeTiming = def.time_of_day && INTAKE_LOG_TIMINGS.includes(def.time_of_day) ? def.time_of_day : null;
    logIntake.mutate(
      {
        name: def.name,
        dose_amount: def.dose_amount,
        dose_unit: def.dose_unit,
        time_of_day: safeTiming,
        date,
      },
      { onSuccess: () => toast.success(`${def.name} marked taken`) }
    );
  }

  function undoTaken(logId: string, name: string) {
    deleteIntake.mutate(logId, { onSuccess: () => toast.success(`${name} unmarked`) });
  }

  if (activeDefs.length === 0) {
    return (
      <DashboardCard title="Supplements" span="lg:col-span-1">
        <p className="text-sm text-muted-foreground">No supplements configured — add some in Settings</p>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title="Supplements" span="lg:col-span-1">
      {isError ? (
        <p className="text-sm text-destructive">
          {getErrorMessage(error, "Couldn't load today's supplement log.")}{" "}
          <button onClick={() => refetch()} className="underline">Retry</button>
        </p>
      ) : isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {activeDefs.map((def) => {
            const taken = logs.filter((l) => l.name.toLowerCase() === def.name.toLowerCase());
            const isTaken = taken.length > 0;
            const contributions = getMicroContributions(def);
            return (
              <div key={def.id} className="group pill p-3 rounded-xl transition-all duration-200">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => (isTaken ? undoTaken(taken[0].id, def.name) : markTaken(def))}
                    disabled={logIntake.isPending || deleteIntake.isPending}
                    aria-label={isTaken ? `Undo ${def.name}` : `Mark ${def.name} taken`}
                    className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                      isTaken ? "border-primary/40 bg-primary/10" : "border-border bg-muted/50 hover:bg-muted"
                    }`}
                  >
                    {isTaken && (
                      <svg className="h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm truncate ${isTaken ? "text-foreground/90" : "text-muted-foreground"}`}>
                        {def.name}
                      </p>
                      {def.time_of_day && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {def.time_of_day}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {def.dose_amount} {def.dose_unit}
                      {taken.length > 1 && ` · taken ${taken.length}x`}
                    </p>
                  </div>
                  {!isTaken && (
                    <Button
                      onClick={() => markTaken(def)}
                      disabled={logIntake.isPending}
                      variant="outline"
                      size="xs"
                      className="shrink-0"
                    >
                      Take
                    </Button>
                  )}
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
