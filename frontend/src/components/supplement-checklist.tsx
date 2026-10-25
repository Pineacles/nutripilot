"use client";

import type { SupplementDefinition, MicronutrientTargetItem } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";
import { Button } from "@/components/ui/button";
import { useSupplementLogDay } from "@/hooks/queries";
import { useLogSupplementIntake, useDeleteSupplementLog } from "@/hooks/mutations/supplement-log";
import { getErrorMessage } from "@/lib/api";
import { INTAKE_LOG_TIMINGS } from "@/lib/supplement-constants";
import { toast } from "sonner";
import { useTracked } from "@/hooks/use-tracked";
import { plateOf } from "@/lib/plates";

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
  /** Day being viewed on Today: drives the actionable "taken today" state. */
  date: string;
  definitions?: SupplementDefinition[];
  microTargets?: MicronutrientTargetItem[];
}

export function SupplementsCard({ date, definitions = [], microTargets = [] }: Props) {
  const { data: logs = [], isLoading, isError, error, refetch } = useSupplementLogDay(date);
  const logIntake = useLogSupplementIntake();
  const deleteIntake = useDeleteSupplementLog();
  const { shows } = useTracked();

  const activeDefs = definitions.filter((d) => d.active);

  function getMicroContributions(def: SupplementDefinition) {
    if (!def.micronutrients) return null;
    // Hidden nutrients drop out of the contribution lines; the supplement itself stays.
    return Object.entries(def.micronutrients).filter(([key]) => shows(key)).map(([key, value]) => {
      const target = microTargets.find((t) => t.nutrient === key);
      const label = MICRO_LABELS[key] || key;
      const pct = target && target.target_value > 0 ? Math.round((value / target.target_value) * 100) : null;
      const unit = target?.unit || "";
      return { key, label, value, unit, pct };
    });
  }

  function markTaken(def: SupplementDefinition) {
    // Supplement *definitions* allow free-form time_of_day (e.g. "with meal"), but the
    // intake-log endpoint restricts it to morning/afternoon/evening, drop anything else
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
        <p className="text-sm text-muted-foreground">No supplements configured, add some in Settings</p>
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
        <div className="divide-y divide-g2 border-y border-g2">
          {activeDefs.map((def) => {
            const taken = logs.filter((l) => l.name.toLowerCase() === def.name.toLowerCase());
            const isTaken = taken.length > 0;
            const contributions = getMicroContributions(def);
            return (
              <div key={def.id} className="group py-2.5">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => (isTaken ? undoTaken(taken[0].id, def.name) : markTaken(def))}
                    disabled={logIntake.isPending || deleteIntake.isPending}
                    aria-label={isTaken ? `Undo ${def.name}` : `Mark ${def.name} taken`}
                    aria-pressed={isTaken}
                    className="flex min-h-10 flex-1 min-w-0 items-center gap-3 text-left"
                  >
                    <span
                      className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors duration-(--dur) ${
                        isTaken ? "border-done bg-done/15" : "border-g3"
                      }`}
                    >
                      {isTaken && (
                        <svg className="h-3 w-3 text-done" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path className="animate-check" pathLength={1} strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className={`truncate text-[15px] ${isTaken ? "text-ink" : "text-g5"}`}>
                          {def.name}
                        </span>
                        {def.time_of_day && <span className="shrink-0 text-[12px] text-g4">{def.time_of_day}</span>}
                      </span>
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        {def.dose_amount} {def.dose_unit}
                        {taken.length > 1 && ` · taken ${taken.length}x`}
                      </span>
                    </span>
                  </button>
                  {!isTaken && (
                    <Button
                      onClick={() => markTaken(def)}
                      disabled={logIntake.isPending}
                      variant="outline"
                      size="xs"
                      className="h-10 shrink-0 rounded-full border-g3 bg-transparent px-4 text-[13px] hover:border-g5 dark:border-g3 dark:bg-transparent dark:hover:bg-g2"
                    >
                      Take
                    </Button>
                  )}
                </div>
                {contributions && contributions.length > 0 && (
                  <div className="ml-8 mt-1.5 space-y-0.5">
                    {contributions.map((c) => (
                      <p key={c.label} className="text-[12px] text-g4">
                        {c.value} {c.unit} <span style={plateOf(c.key) !== "var(--ink)" ? { color: plateOf(c.key) } : undefined}>{c.label}</span>
                        {c.pct != null && <span className="tabular-nums">, {c.pct}% of target</span>}
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
