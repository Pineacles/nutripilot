"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { WaterTotals, CaffeineTotals, WaterLogRow } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fmt } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { useWaterLogDay } from "@/hooks/queries";
import { useLogWater, useUpdateWaterLog, useDeleteWaterLog } from "@/hooks/mutations/water";
import { WATER_LOG_BOUNDS, validateBounds } from "@/lib/validation";
import { getErrorMessage } from "@/lib/api";
import { useTracked } from "@/hooks/use-tracked";

interface Props {
  water: WaterTotals;
  caffeine: CaffeineTotals;
  /** Day being viewed on Today: drives quick-add and the entries list. */
  date: string;
}

function WaterEntryRow({ entry, date }: { entry: WaterLogRow; date: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(entry.amount_ml));
  const updateLog = useUpdateWaterLog();
  const deleteLog = useDeleteWaterLog();
  const logWater = useLogWater();

  const error = editing ? validateBounds(Number(value), WATER_LOG_BOUNDS) : null;

  function save() {
    if (error) return;
    updateLog.mutate(
      { id: entry.id, amount_ml: Number(value) },
      { onSuccess: () => { toast.success("Water entry updated"); setEditing(false); } }
    );
  }

  function remove() {
    deleteLog.mutate(entry.id, {
      onSuccess: () =>
        toast.success("Water entry removed", {
          action: {
            label: "Undo",
            onClick: () => logWater.mutate({ amount_ml: entry.amount_ml, date }),
          },
        }),
    });
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-1.5">
        <Input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          min={WATER_LOG_BOUNDS.min}
          max={WATER_LOG_BOUNDS.max}
          aria-invalid={!!error}
          className="flex-1 tabular-nums"
          inputMode="numeric"
        />
        <Button size="sm" onClick={save} disabled={!!error || updateLog.isPending}>Save</Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    );
  }

  return (
    <div className="group flex min-h-[60px] items-center justify-between">
      <span className="text-[17px] font-medium tabular-nums text-ink">{fmt(entry.amount_ml, 0)} ml</span>
      <div className="flex items-center">
        <button onClick={() => setEditing(true)} className="h-11 rounded-full px-3 text-[13px] text-g5 transition-colors hover:text-ink">Edit</button>
        <button onClick={remove} disabled={deleteLog.isPending} className="h-11 rounded-full px-3 text-[13px] text-g5 transition-colors hover:text-ink disabled:opacity-50">Delete</button>
      </div>
    </div>
  );
}

export function HydrationCard({ water, caffeine, date }: Props) {
  const [showCustom, setShowCustom] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [showEntries, setShowEntries] = useState(false);
  const { shows } = useTracked();
  const showWater = shows("water");
  const showCaffeine = shows("caffeine");

  const waterPct = water.target_ml > 0 ? Math.min((water.total_ml / water.target_ml) * 100, 100) : 0;
  const caffPct = caffeine.target_mg > 0 ? Math.min((caffeine.total_mg / caffeine.target_mg) * 100, 100) : 0;
  const caffOver = caffeine.total_mg > caffeine.target_mg;

  const logWater = useLogWater();
  const { data: entries = [], isError, error, refetch } = useWaterLogDay(date);

  function quickAdd(amountMl: number) {
    logWater.mutate({ amount_ml: amountMl, date }, { onSuccess: () => toast.success(`+${amountMl} ml water`) });
  }

  const customError = showCustom ? validateBounds(Number(customAmount), WATER_LOG_BOUNDS) : null;

  function submitCustom() {
    if (customError || !customAmount) return;
    logWater.mutate(
      { amount_ml: Number(customAmount), date },
      {
        onSuccess: () => {
          toast.success(`+${customAmount} ml water`);
          setCustomAmount("");
          setShowCustom(false);
        },
      }
    );
  }

  if (!showWater && !showCaffeine) return null;

  return (
    <DashboardCard title="Hydration & Caffeine">
      <div className="space-y-6">
        {/* Water wears its plate ink on a g2 track */}
        {showWater && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs text-g4">Water</span>
            <span className="text-[15px] tabular-nums text-ink">
              <span className="font-medium text-water">{fmt(water.total_ml, 0)} ml</span>
              <span className="text-xs text-g4"> / {fmt(water.target_ml, 0)} ml</span>
            </span>
          </div>
          <div className="h-[3px] w-full bg-g2">
            <div className="animate-bar h-full bg-water" style={{ width: `${waterPct}%` }} />
          </div>

          {/* Quick add */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => quickAdd(250)} disabled={logWater.isPending}>+250 ml</Button>
            <Button size="sm" variant="outline" onClick={() => quickAdd(500)} disabled={logWater.isPending}>+500 ml</Button>
            {!showCustom ? (
              <Button size="sm" variant="ghost" onClick={() => setShowCustom(true)}>Custom</Button>
            ) : (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="ml"
                  className="h-10 w-20"
                  aria-invalid={!!customError}
                  autoFocus
                />
                <Button size="sm" onClick={submitCustom} disabled={!!customError || !customAmount || logWater.isPending}>Add</Button>
                <Button size="icon-sm" variant="ghost" aria-label="Cancel custom amount" onClick={() => { setShowCustom(false); setCustomAmount(""); }}>✕</Button>
              </div>
            )}
            <button
              onClick={() => setShowEntries(true)}
              className="ml-auto flex h-11 items-center px-1 text-xs text-g4 underline underline-offset-2 transition-colors hover:text-ink"
            >
              {entries.length > 0 ? `${entries.length} entries` : "No entries"}
            </button>
          </div>
        </div>
        )}
        {/* Caffeine: over a limit is said in words and weight */}
        {showCaffeine && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs text-g4">
              Caffeine
              {caffOver && <span className="font-medium text-alert"> (over)</span>}
            </span>
            <span className="text-[15px] tabular-nums text-ink">
              <span className={caffOver ? "font-semibold text-alert" : "font-medium text-caffeine"}>{fmt(caffeine.total_mg, 0)} mg</span>
              <span className="text-xs text-g4"> / {fmt(caffeine.target_mg, 0)} mg</span>
            </span>
          </div>
          <div className="h-[3px] w-full bg-g2">
            <div className={`animate-bar h-full ${caffOver ? "bg-alert" : "bg-caffeine"}`} style={{ width: `${caffPct}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-g4">Tracked automatically from logged food and drinks</p>
        </div>
        )}
      </div>

      <Dialog open={showEntries} onOpenChange={setShowEntries}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Water entries</DialogTitle>
          </DialogHeader>
          {isError ? (
            <p className="text-[15px] text-ink">
              {getErrorMessage(error, "Couldn't load entries.")}{" "}
              <button onClick={() => refetch()} className="underline">Retry</button>
            </p>
          ) : entries.length === 0 ? (
            <EmptyState message="No water logged for this day yet" className="py-2" />
          ) : (
            <div className="max-h-[50vh] overflow-y-auto thin-scrollbar divide-y divide-g2">
              {entries.map((entry) => <WaterEntryRow key={entry.id} entry={entry} date={date} />)}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardCard>
  );
}
