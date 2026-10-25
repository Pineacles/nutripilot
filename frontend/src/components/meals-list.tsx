"use client";

import { useMemo, useState } from "react";
import { Copy, Plus, Repeat } from "lucide-react";
import type { FoodLogDetailEntry, MealType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EditFoodLogDialog } from "./food-log/edit-food-log-dialog";
import { CopyMealDialog, dayName, useCopyMeal } from "./food-log/copy-meal-dialog";
import { useFoodLogDay } from "@/hooks/queries";
import { getErrorMessage } from "@/lib/api";
import { MEAL_TYPES, MEAL_TYPE_LABELS, mealForTime } from "@/lib/meal-types";
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
  /** A meal's own +: opens Log food with that meal chosen. */
  onAddToMeal?: (meal: MealType) => void;
}

export function MealsLogCard({ date, className, onAddToMeal }: Props) {
  const { data, isLoading, isError, error, refetch } = useFoodLogDay(date);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [editingEntry, setEditingEntry] = useState<FoodLogDetailEntry | null>(null);
  const [copying, setCopying] = useState<{ date: string; meal_type: MealType; items: number; kcal: number } | null>(null);

  const groups = useMemo(() => groupByMeal(data?.entries ?? []), [data]);

  // Entries that arrive after the day was first shown flash once (a food just logged); the first
  // load of a day, and a change of day, flash nothing. Adjusted during render, not in an effect.
  const [seen, setSeen] = useState<{ date: string; ids: Set<string> } | null>(null);
  const [lit, setLit] = useState<Set<string>>(new Set());
  if (data && data.date === date && (!seen || seen.date !== date || seen.ids.size !== data.entries.length || data.entries.some((e) => !seen.ids.has(e.id)))) {
    const ids = new Set(data.entries.map((e) => e.id));
    setSeen({ date, ids });
    setLit(seen && seen.date === date ? new Set([...ids].filter((id) => !seen.ids.has(id))) : new Set());
  }

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

  // Collapsed by default: one ruled row per meal; a tap opens its entries for editing.
  function toggle(mealType: string) {
    setOpen((prev) => ({ ...prev, [mealType]: !prev[mealType] }));
  }

  // The latest meal is in full ink, earlier ones step back; a food logged minutes ago is marked.
  const latestMeal = useMemo(() => {
    let best: { meal: string; at: string } | null = null;
    for (const e of data?.entries ?? []) {
      if (e.logged_at && (!best || e.logged_at > best.at)) best = { meal: e.meal_type, at: e.logged_at };
    }
    return best?.meal ?? null;
  }, [data]);
  const [now] = useState(() => Date.now());
  const isFresh = (e: FoodLogDetailEntry) => !!e.logged_at && now - new Date(e.logged_at).getTime() < 15 * 60_000;
  const total = groups.reduce((sum, g) => sum + g.kcal, 0);
  // Entries the agent logs without a time all carry the same one; a column of identical times says
  // nothing, so times show only when the day's meals have different ones.
  const firstTime = (g: { items: FoodLogDetailEntry[] }) => g.items.map((i) => i.logged_at).filter(Boolean).sort()[0] ?? null;
  const fmtTime = (t: string | null) => (t ? new Date(t).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" }) : "");
  const showTimes = new Set(groups.map((g) => fmtTime(firstTime(g)))).size > 1;
  const cols = showTimes ? "grid-cols-[3.25rem_1fr_auto]" : "grid-cols-[1fr_auto]";

  return (
    <section aria-labelledby="meals-heading" className={cn("clay-card p-5 lg:col-span-2", className)}>
      <div className="mb-1 flex items-baseline justify-between">
        <h2 id="meals-heading" className="text-[15px] font-medium text-foreground">Meals</h2>
        {groups.length > 0 && <span className="text-sm tabular-nums text-g4">{Math.round(total)} kcal</span>}
      </div>
      {isError ? (
        <p className="py-3 text-sm text-destructive">{getErrorMessage(error, "Couldn't load meals.")}{" "}
          <button onClick={() => refetch()} className="underline">Retry</button>
        </p>
      ) : isLoading ? (
        <div className="divide-y divide-g2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse bg-g1/60" />)}
        </div>
      ) : (
        <ol className="divide-y divide-g2 border-b border-g2">
          {MEAL_TYPES.map((meal) => {
            const group = groups.find((g) => g.meal_type === meal);
            const label = MEAL_TYPE_LABELS[meal];
            if (!group) {
              return (
                <li key={meal} className={`grid ${cols} items-center`}>
                  {showTimes && <span aria-hidden="true" />}
                  <span className="py-4 text-[17px] text-g4">{label}</span>
                  {onAddToMeal && (
                    <button
                      type="button"
                      onClick={() => onAddToMeal(meal)}
                      aria-label={`Log food to ${label.toLowerCase()}`}
                      className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-g4 transition-colors hover:bg-g2 hover:text-ink"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  )}
                </li>
              );
            }
            const expanded = !!open[meal];
            const time = fmtTime(firstTime(group));
            // Today: the meal for this time of day burns brightest, matching the Log food bar.
            // Another day: every logged meal in full ink.
            const current = date === todayStr() ? meal === mealForTime() || (meal === latestMeal && !groups.some((g) => g.meal_type === mealForTime())) : true;
            return (
              <li key={meal}>
                <div className={`grid ${cols} items-center ${group.items.some((i) => lit.has(i.id)) ? "animate-lit" : ""}`}>
                  {showTimes && <span className="text-[13px] tabular-nums text-g4">{time}</span>}
                  <button
                    type="button"
                    onClick={() => toggle(meal)}
                    aria-expanded={expanded}
                    className="min-w-0 py-3.5 pr-3 text-left"
                  >
                    <span className={`flex items-baseline justify-between gap-3 text-[17px] font-medium ${current ? "text-ink" : "text-g5"}`}>
                      <span className="truncate">{label}</span>
                      <span className="shrink-0 tabular-nums">{Math.round(group.kcal)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-g4">
                      {group.items.map((i) => i.food_name).join(", ")}
                    </span>
                  </button>
                  {onAddToMeal && (
                    <button
                      type="button"
                      onClick={() => onAddToMeal(meal)}
                      aria-label={`Log food to ${label.toLowerCase()}`}
                      className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-g4 transition-colors hover:bg-g2 hover:text-ink"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  )}
                </div>
                {/* Always in the tree so the reveal can ease the row height; inert while closed */}
                <div
                  inert={!expanded}
                  className={`grid transition-[grid-template-rows,opacity] duration-(--dur) ease-(--ease-out) motion-reduce:transition-none ${
                    expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="-mx-1 min-h-0 overflow-hidden px-1">
                  <div className={`pb-3 ${showTimes ? "pl-[3.25rem]" : "pl-0"}`}>
                    <ul className="divide-y divide-g2 border-t border-g2">
                      {group.items.map((item) => (
                        <li key={item.id} className={lit.has(item.id) ? "animate-lit" : ""}>
                          <button
                            onClick={() => setEditingEntry(item)}
                            className="flex w-full items-center justify-between gap-3 py-2.5 text-left transition-colors hover:bg-g1"
                          >
                            <span className="min-w-0">
                              <span className="flex items-center gap-2 truncate text-[15px] text-ink">
                                {isFresh(item) && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink" aria-label="just logged" />}
                                {item.food_name}
                              </span>
                              <span className="block text-[12px] text-g4">{formatPortion(item.amount, item.unit, item.quantity_g, item.unit_label)}</span>
                            </span>
                            <span className="shrink-0 text-[15px] tabular-nums text-g5">
                              {item.nutrients_consumed.kcal != null ? Math.round(item.nutrients_consumed.kcal) : "--"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => setCopying({ date, meal_type: group.meal_type, items: group.items.length, kcal: group.kcal })}
                      className="mt-1 flex h-10 items-center gap-2 text-[13px] text-g5 transition-colors hover:text-ink"
                    >
                      <Copy className="h-4 w-4" aria-hidden="true" />
                      Copy {label.toLowerCase()} to another day
                    </button>
                  </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {!isLoading && !isError && repeatChips.length > 0 && (
        <div className="pt-4">
          <p className="mb-2 flex items-center gap-1.5 text-[13px] text-g4">
            <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
            Same as {dayName(previousDate)}?
          </p>
          <div className="flex flex-wrap gap-2">
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
                className="flex h-10 items-center gap-2 rounded-full border border-g3 px-4 text-[13px] transition-colors hover:border-g4 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="font-medium text-ink">{MEAL_TYPE_LABELS[g.meal_type]}</span>
                <span className="tabular-nums text-g4">{Math.round(g.kcal)} kcal</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <EditFoodLogDialog entry={editingEntry} onClose={() => setEditingEntry(null)} />
      <CopyMealDialog source={copying} onClose={() => setCopying(null)} />
    </section>
  );
}
