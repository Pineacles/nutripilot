"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { Band } from "./band";
import { useWeightLogList } from "@/hooks/queries";
import { MeasurementDialog } from "./measurement-dialog";
import { getErrorMessage } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { fmtDate } from "@/lib/chart-utils";
import type { WeightLogRow } from "@/lib/types";

const LATEST = 3;
const PAGE = 20;
const rowBtn =
  "flex min-h-[60px] w-full items-center gap-3 py-2 text-left outline-none transition-colors hover:bg-g1 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink";

export function MeasurementsList({ onAdd, addOpen, onAddOpenChange }: {
  /** The page owns the Add dialog so its top row can open it too. */
  onAdd: () => void;
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
}) {
  const { data = [], isLoading, isError, error, refetch } = useWeightLogList();

  const [editEntry, setEditEntry] = useState<WeightLogRow | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [shown, setShown] = useState(PAGE);

  const recent = useMemo(() => [...data].reverse(), [data]);
  const rows = expanded ? recent.slice(0, Math.max(shown, LATEST)) : recent.slice(0, LATEST);
  const remaining = recent.length - rows.length;

  return (
    <Band title="Measurements" aside={recent.length > 0 ? recent.length : undefined}>
      {isError ? (
        <p className="py-4 text-[15px] text-ink">
          {getErrorMessage(error, "Couldn't load measurements.")}{" "}
          <button onClick={() => refetch()} className="underline underline-offset-4">Try again</button>
        </p>
      ) : isLoading ? (
        <div className="space-y-px" aria-busy="true" aria-label="Loading measurements">
          {[1, 2, 3].map((i) => <div key={i} className="h-[60px] animate-pulse bg-g1" />)}
        </div>
      ) : recent.length === 0 ? (
        <div className="border-y border-g2 py-8">
          <p className="text-[15px] text-g4">Nothing logged yet. Weigh in and add it to start your trend.</p>
          <button onClick={onAdd} className="mt-4 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-medium text-g0 transition-transform active:scale-[0.98]">
            <Plus className="h-4 w-4" aria-hidden="true" /> Add measurement
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-g2 border-y border-g2">
          {rows.map((entry) => (
            <li key={entry.id}>
              <button type="button" onClick={() => setEditEntry(entry)} className={rowBtn} aria-label={`Edit or delete the measurement of ${fmtDate(entry.date)}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-medium tabular-nums text-ink">{fmt(entry.weight_kg)} kg</p>
                  <p className="truncate text-[12px] tabular-nums text-g4">
                    {fmtDate(entry.date)}
                    {entry.body_fat_pct != null && <> · <span className="text-bodyfat">{fmt(entry.body_fat_pct)}% fat</span></>}
                    {entry.muscle_mass_pct != null && <> · <span className="text-muscle">{fmt(entry.muscle_mass_pct)}% muscle</span></>}
                    {entry.source !== "manual" && ` · ${entry.source}`}
                  </p>
                </div>
              </button>
            </li>
          ))}
          {recent.length > LATEST && (
            <li>
              <button
                type="button"
                onClick={() => { setExpanded((e) => !e); setShown(PAGE); }}
                aria-expanded={expanded}
                className={`${rowBtn} min-h-11 justify-between text-[15px] text-g5`}
              >
                {expanded ? "Show latest 3" : `All ${recent.length} measurements`}
                <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
            </li>
          )}
          {expanded && remaining > 0 && (
            <li>
              <button type="button" onClick={() => setShown((n) => n + PAGE)} className={`${rowBtn} min-h-11 text-[13px] font-medium text-g5 hover:text-ink`}>
                Show {Math.min(PAGE, remaining)} more
              </button>
            </li>
          )}
        </ul>
      )}

      <MeasurementDialog open={addOpen} onOpenChange={onAddOpenChange} />
      <MeasurementDialog open={!!editEntry} onOpenChange={(next) => !next && setEditEntry(null)} entry={editEntry} />
    </Band>
  );
}
