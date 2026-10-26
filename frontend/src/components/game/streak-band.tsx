"use client";

import { useState } from "react";
import { DoneCheck, GoalArc } from "./goal-arc";
import { buzz, goalInk } from "@/lib/game";
import type { DayGoal, GameState } from "@/lib/game-types";

const SHORT: Record<string, string> = { meals: "Meals", protein: "Protein", water: "Water", fiber: "Fiber", supplements: "Supplements", calories: "Calories" };

/** Compact enough for three cells on a phone: "4/3", "150/170 g", "1.1/2.5 l". */
function goalText(g: DayGoal): string {
  if (g.unit === "kcal") return `${Math.round(g.value)}/${Math.round(g.target)}`;
  if (g.unit === "ml") return `${(g.value / 1000).toFixed(1)}/${(g.target / 1000).toFixed(1)} l`;
  const v = Math.round(g.value);
  const t = Math.round(g.target);
  return g.unit === "g" ? `${v}/${t} g` : `${v}/${t}`;
}

/** Remember the last value of something and say whether it just changed to `to`. */
function useBecame<T>(value: T, to: T): boolean {
  const [last, setLast] = useState(value);
  const [became, setBecame] = useState(false);
  if (last !== value) {
    setLast(value);
    setBecame(value === to);
  }
  return became;
}

/**
 * Under the day poster: the day goals as small quarter arcs. Closing every goal sweeps a Done Green
 * rule under the band. (The streak itself sits in the poster's hero.)
 */
export function StreakBand({ game }: { game: GameState }) {
  const { day_goals: goals } = game;
  const closedNow = useBecame(game.day_closed, true);
  const [doneNow, setDoneNow] = useState<Set<string>>(new Set());
  const [lastDone, setLastDone] = useState(() => new Set(goals.filter((g) => g.done).map((g) => g.key)));
  const doneKeys = goals.filter((g) => g.done).map((g) => g.key);
  if (doneKeys.join() !== [...lastDone].join()) {
    const fresh = new Set(doneKeys.filter((k) => !lastDone.has(k)));
    setLastDone(new Set(doneKeys));
    setDoneNow(fresh);
    if (fresh.size > 0) buzz(game.day_closed ? [20, 40, 20, 40, 60] : 25);
  }


  return (
    <section aria-label="Day goals" className="relative border-b border-g2 md:col-span-2 lg:col-span-3">
      {goals.length > 0 && (
        <div
          className="grid divide-x divide-g2"
          style={{ gridTemplateColumns: `repeat(${goals.length}, minmax(0, 1fr))` }}
        >
          {goals.map((g, i) => (
            <div key={g.key} className={`flex min-w-0 items-center gap-2 py-3 ${i === 0 ? "pr-2" : "px-2 min-[400px]:px-3"}`}>
              <GoalArc fraction={g.target > 0 ? g.value / g.target : 0} ink={goalInk(g.key)} size={24} />
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-[12px] text-g4">
                  <span className="truncate">{SHORT[g.key] ?? g.label}</span>
                  {g.done && <DoneCheck animate={doneNow.has(g.key)} size={13} />}
                </p>
                <p className={`truncate text-[13px] tabular-nums ${g.done ? "text-ink" : "text-g5"}`}>{goalText(g)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Every goal closed: a Done Green rule draws along the bottom of the band */}
      {game.day_closed && (
        <>
          <span aria-hidden="true" className={`absolute inset-x-0 -bottom-px block h-0.5 bg-done ${closedNow ? "animate-rule" : ""}`} />
          <p className="sr-only" role="status">Day closed</p>
        </>
      )}
    </section>
  );
}
