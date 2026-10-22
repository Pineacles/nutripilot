"use client";

import { useMemo, useState } from "react";
import { Copy, Repeat } from "lucide-react";
import type { FoodLogDetailEntry, MealType } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";
import { EditFoodLogDialog } from "./food-log/edit-food-log-dialog";
import { CopyMealDialog, dayName, useCopyMeal } from "./food-log/copy-meal-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useFoodLogDay } from "@/hooks/queries";
import { getErrorMessage } from "@/lib/api";
import { MEAL_TYPES, MEAL_TYPE_LABELS } from "@/lib/meal-types";
import { formatPortion } from "@/lib/portion";
import { addDays, todayStr } from "@/lib/dates";

type MealGroup = { meal_type: MealType; items: FoodLogDetailEntry[]; kcal: number };

function groupByMeal(entries: FoodLogDetailEntry[]): MealGroup[] {
  const byMeal = new Map<string, FoodLogDetailEntry[]>();
  for (const entry of entries) {
    const list = byMeal.get(entry.meal_type) ?? [];
    list.push(entry);
    byMeal.set(entry.meal_type, list);
  }
  return MEAL_TYPES.filter((mt) => byMeal.has(mt)).map((mt) => {
    const items = byMeal.get(mt)!;
    return { meal_type: mt, items, kcal: items.reduce((sum, item) => sum + (item.nutrients_consumed.kcal || 0), 0) };
  });
}

interface Props {
  /** The currently viewed day (drives its own fetch, decoupled from the today-summary
   *  totals, since editing/deleting a log entry needs its id, which the aggregate
   *  summary endpoint doesn't carry). */
  date: string;
  className?: string;
}

export function MealsLogCard({ date, className }: Props) {
  const { data, isLoading, isError, error, refetch } = useFoodLogDay(date);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editingEntry, setEditingEntry] = useState<FoodLogDetailEntry | null>(null);
  const [copying, setCopying] = useState<{ date: string; meal_type: MealType; items: number; kcal: number } | null>(null);

  const groups = useMemo(() => groupByMeal(data?.entries ?? []), [data]);

  // Meals from the day before that this day doesn't have yet: one tap logs them again.
  const previousDate = addDays(date, -1);
  const showRepeat = date <= todayStr();
  const { data: previous } = useFoodLogDay(previousDate, showRepeat);
  const repeatable = useMemo(() => {
    if (!data || !previous) return [];
    const have = new Set(data.entries.map((e) => e.meal_type));
    return groupByMeal(previous.entries).filter((g) => !have.has(g.meal_type));
  }, [data, previous]);
  const { run: copyMeal, isPending: copyPending } = useCopyMeal();
  // Hidden as soon as tapped, so a second tap before the day reloads can't copy it again.
  const [repeated, setRepeated] = useState<Set<string>>(new Set());
  const repeatKey = (meal: string) => `${previousDate}>${date}:${meal}`;
  const repeatChips = repeatable.filter((g) => !repeated.has(repeatKey(g.meal_type)));

  function toggle(mealType: string) {
    setCollapsed((prev) => ({ ...prev, [mealType]: !prev[mealType] }));
  }

  return (
    <DashboardCard title="Meals" span="lg:col-span-2" className={className}>
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
            const mealLabel = MEAL_TYPE_LABELS[group.meal_type] || group.meal_type;
            return (
              <div key={group.meal_type}>
                <div className="pill flex items-center rounded-xl">
                <button
                  onClick={() => toggle(group.meal_type)}
                  aria-expanded={!isCollapsed}
                  className="flex min-w-0 flex-1 items-center justify-between py-3 pl-4 pr-2 rounded-l-xl cursor-pointer transition-all duration-200 hover:bg-white/[0.03]"
                >
                  <div className="flex items-center gap-2">
                    <svg
                      className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isCollapsed ? "" : "rotate-90"}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-sm font-medium text-foreground/80">{mealLabel}</span>
                    <span className="text-xs text-muted-foreground">{group.items.length} {group.items.length === 1 ? "item" : "items"}</span>
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {Math.round(group.kcal)} kcal
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setCopying({ date, meal_type: group.meal_type, items: group.items.length, kcal: group.kcal })}
                  aria-label={`Copy ${mealLabel.toLowerCase()} to another day`}
                  title="Copy to another day"
                  className="mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Copy className="h-4 w-4" />
                </button>
                </div>
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
                      <div className="min-w-0 text-left">
                        <p className="text-foreground/80 truncate">{item.food_name}</p>
                        <p className="text-xs text-muted-foreground">{formatPortion(item.amount, item.unit, item.quantity_g, item.unit_label)}</p>
                      </div>
                      <span className="tabular-nums text-muted-foreground shrink-0 ml-2">
                        {item.nutrients_consumed.kcal != null ? `${Math.round(item.nutrients_consumed.kcal)} kcal` : "--"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && !isError && repeatChips.length > 0 && (
        <div className={groups.length ? "mt-3 border-t border-border/60 pt-3" : "mt-1"}>
          <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Repeat className="h-3.5 w-3.5" />
            Same as {dayName(previousDate)}?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {repeatChips.map((g) => (
              <button
                key={g.meal_type}
                type="button"
                disabled={copyPending}
                onClick={() => {
                  const key = repeatKey(g.meal_type);
                  setRepeated((s) => new Set(s).add(key));
                  // The day has reloaded by the time either runs, so the chip can follow the data again
                  // (and comes back after Undo).
                  const release = () =>
                    setRepeated((s) => {
                      const next = new Set(s);
                      next.delete(key);
                      return next;
                    });
                  copyMeal({ from_date: previousDate, to_date: date, meal_type: g.meal_type }, release, release);
                }}
                aria-label={`Log ${dayName(previousDate)}'s ${MEAL_TYPE_LABELS[g.meal_type].toLowerCase()} again, ${g.items.length} ${g.items.length === 1 ? "item" : "items"}, ${Math.round(g.kcal)} kcal`}
                className="pill flex h-10 items-center gap-2 rounded-full px-3.5 text-xs transition-colors hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="font-medium text-foreground/85">{MEAL_TYPE_LABELS[g.meal_type]}</span>
                <span className="tabular-nums text-muted-foreground">
                  {g.items.length} {g.items.length === 1 ? "item" : "items"} · {Math.round(g.kcal)} kcal
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <EditFoodLogDialog entry={editingEntry} onClose={() => setEditingEntry(null)} />
      <CopyMealDialog source={copying} onClose={() => setCopying(null)} />
    </DashboardCard>
  );
}
