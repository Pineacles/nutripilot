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

interface Props {
  water: WaterTotals;
  caffeine: CaffeineTotals;
  /** Day being viewed on Today: drives quick-add and the entries list. */
  date: string;
}

function WaterEntryRow({ entry }: { entry: WaterLogRow }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(entry.amount_ml));
  const updateLog = useUpdateWaterLog();
  const deleteLog = useDeleteWaterLog();

  const error = editing ? validateBounds(Number(value), WATER_LOG_BOUNDS) : null;

  function save() {
    if (error) return;
    updateLog.mutate(
      { id: entry.id, amount_ml: Number(value) },
      { onSuccess: () => { toast.success("Water entry updated"); setEditing(false); } }
    );
  }

  function remove() {
    deleteLog.mutate(entry.id, { onSuccess: () => toast.success("Water entry removed") });
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
          className="h-7 flex-1 tabular-nums"
        />
        <Button size="xs" onClick={save} disabled={!!error || updateLog.isPending}>Save</Button>
        <Button size="xs" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-1.5 group">
      <span className="text-sm tabular-nums text-foreground">{fmt(entry.amount_ml, 0)} ml</span>
      <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setEditing(true)} className="text-xs text-muted-foreground hover:text-foreground px-1.5">Edit</button>
        <button onClick={remove} disabled={deleteLog.isPending} className="text-xs text-muted-foreground hover:text-destructive px-1.5">Delete</button>
      </div>
    </div>
  );
}

export function HydrationCard({ water, caffeine, date }: Props) {
  const [showCustom, setShowCustom] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [showEntries, setShowEntries] = useState(false);

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

  return (
    <DashboardCard title="Hydration & Caffeine">
      <div className="space-y-4">
        {/* Water */}
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#06b6d4" }} />
              <span className="text-sm text-muted-foreground">Water</span>
            </div>
            <span className="text-sm tabular-nums text-foreground">
              <span className="font-semibold">{fmt(water.total_ml, 0)} ml</span>
              <span className="text-muted-foreground/50"> / {fmt(water.target_ml, 0)} ml</span>
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted/60 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${waterPct}%`, background: "linear-gradient(90deg, #06b6d4, #22d3ee)" }} />
          </div>

          {/* Quick add */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <Button size="xs" variant="secondary" onClick={() => quickAdd(250)} disabled={logWater.isPending}>+250ml</Button>
            <Button size="xs" variant="secondary" onClick={() => quickAdd(500)} disabled={logWater.isPending}>+500ml</Button>
            {!showCustom ? (
              <Button size="xs" variant="ghost" onClick={() => setShowCustom(true)}>Custom</Button>
            ) : (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="ml"
                  className="h-6 w-20 text-xs"
                  aria-invalid={!!customError}
                  autoFocus
                />
                <Button size="xs" onClick={submitCustom} disabled={!!customError || !customAmount || logWater.isPending}>Add</Button>
                <Button size="xs" variant="ghost" onClick={() => { setShowCustom(false); setCustomAmount(""); }}>✕</Button>
              </div>
            )}
            <button
              onClick={() => setShowEntries(true)}
              className="ml-auto text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              {entries.length > 0 ? `${entries.length} entries` : "No entries"}
            </button>
          </div>
        </div>
        {/* Caffeine */}
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#92400e" }} />
              <span className="text-sm text-muted-foreground">Caffeine</span>
            </div>
            <span className="text-sm tabular-nums text-foreground">
              <span className={`font-semibold ${caffOver ? "text-destructive" : ""}`}>{fmt(caffeine.total_mg, 0)} mg</span>
              <span className="text-muted-foreground/50"> / {fmt(caffeine.target_mg, 0)} mg</span>
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted/60 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${caffPct}%`, background: caffOver ? "linear-gradient(90deg, #ef4444, #f87171)" : "linear-gradient(90deg, #92400e, #b45309)" }} />
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-1">Tracked automatically from logged food/drinks</p>
        </div>
      </div>

      <Dialog open={showEntries} onOpenChange={setShowEntries}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Water entries</DialogTitle>
          </DialogHeader>
          {isError ? (
            <p className="text-sm text-destructive">
              {getErrorMessage(error, "Couldn't load entries.")}{" "}
              <button onClick={() => refetch()} className="underline">Retry</button>
            </p>
          ) : entries.length === 0 ? (
            <EmptyState message="No water logged for this day yet" className="py-2" />
          ) : (
            <div className="max-h-[50vh] overflow-y-auto thin-scrollbar divide-y divide-border">
              {entries.map((entry) => <WaterEntryRow key={entry.id} entry={entry} />)}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardCard>
  );
}
