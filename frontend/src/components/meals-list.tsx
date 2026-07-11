"use client";

import { useMemo, useState } from "react";
import type { FoodLogDetailEntry } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";
import { EditFoodLogDialog } from "./food-log/edit-food-log-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useFoodLogDay } from "@/hooks/queries";
import { getErrorMessage } from "@/lib/api";
import { MEAL_TYPES, MEAL_TYPE_LABELS } from "@/lib/meal-types";

interface Props {
  /** The currently viewed day (drives its own fetch — decoupled from the today-summary
   *  totals, since editing/deleting a log entry needs its id, which the aggregate
   *  summary endpoint doesn't carry). */
  date: string;
}

export function MealsLogCard({ date }: Props) {
  const { data, isLoading, isError, error, refetch } = useFoodLogDay(date);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editingEntry, setEditingEntry] = useState<FoodLogDetailEntry | null>(null);

  const groups = useMemo(() => {
    const entries = data?.entries ?? [];
    const byMeal = new Map<string, FoodLogDetailEntry[]>();
    for (const entry of entries) {
      const list = byMeal.get(entry.meal_type) ?? [];
      list.push(entry);
      byMeal.set(entry.meal_type, list);
    }
    return MEAL_TYPES.filter((mt) => byMeal.has(mt)).map((mt) => ({
      meal_type: mt,
      items: byMeal.get(mt)!,
    }));
  }, [data]);

  function toggle(mealType: string) {
    setCollapsed((prev) => ({ ...prev, [mealType]: !prev[mealType] }));
  }

  return (
    <DashboardCard title="Meals" span="lg:col-span-2">
      {isError ? (
        <p className="text-sm text-destructive">{getErrorMessage(error, "Couldn't load meals.")}{" "}
          <button onClick={() => refetch()} className="underline">Retry</button>
        </p>
      ) : isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-10 rounded-xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState message="No meals logged for this day yet" className="py-2" />
      ) : (
        <div className="space-y-2">
          {groups.map((group) => {
            const isCollapsed = collapsed[group.meal_type];
            const groupKcal = group.items.reduce((sum, item) => sum + (item.nutrients_consumed.kcal || 0), 0);
            return (
              <div key={group.meal_type}>
                <button
                  onClick={() => toggle(group.meal_type)}
                  className="pill flex w-full items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 hover:bg-white/[0.03]"
                >
                  <div className="flex items-center gap-2">
                    <svg
                      className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isCollapsed ? "" : "rotate-90"}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-sm font-medium text-foreground/80">
                      {MEAL_TYPE_LABELS[group.meal_type as keyof typeof MEAL_TYPE_LABELS] || group.meal_type}
                    </span>
                    <span className="text-xs text-muted-foreground">{group.items.length} items</span>
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {Math.round(groupKcal)} kcal
                  </span>
                </button>
                <div
                  className={`ml-8 space-y-0.5 overflow-hidden transition-all duration-300 ease-in-out ${
                    isCollapsed ? "max-h-0 opacity-0 pb-0" : "max-h-[1000px] opacity-100 pb-2 pt-1"
                  }`}
                >
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setEditingEntry(item)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm cursor-pointer transition-all duration-150 border-l-2 border-transparent hover:bg-muted/20 hover:border-primary/20"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-foreground/80 truncate">{item.food_name}</span>
                        <span className="text-xs text-muted-foreground/50 shrink-0">{item.quantity_g}g</span>
                      </div>
                      <span className="tabular-nums text-muted-foreground shrink-0 ml-2">
                        {item.nutrients_consumed.kcal != null ? `${Math.round(item.nutrients_consumed.kcal)} kcal` : "—"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EditFoodLogDialog entry={editingEntry} onClose={() => setEditingEntry(null)} />
    </DashboardCard>
  );
}
