"use client";
import type { WaterTotals, CaffeineTotals } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";
import { fmt } from "@/lib/utils";

interface Props {
  water: WaterTotals;
  caffeine: CaffeineTotals;
}

export function HydrationCard({ water, caffeine }: Props) {
  const waterPct = water.target_ml > 0 ? Math.min((water.total_ml / water.target_ml) * 100, 100) : 0;
  const caffPct = caffeine.target_mg > 0 ? Math.min((caffeine.total_mg / caffeine.target_mg) * 100, 100) : 0;
  const caffOver = caffeine.total_mg > caffeine.target_mg;

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
        </div>
      </div>
    </DashboardCard>
  );
}
