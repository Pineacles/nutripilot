"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { RollingNumber } from "./rolling-number";
import { InkFrame } from "./ink-frame";
import { DoneCheck, GoalArc } from "./goal-arc";
import { buzz, goalInk } from "@/lib/game";
import type { DayGoal, GameState } from "@/lib/game-types";

const SHORT: Record<string, string> = { meals: "Meals", protein: "Protein", water: "Water", fiber: "Fiber", supplements: "Supplements" };

/** Compact enough for three cells on a phone: "4/3", "150/170 g", "1.1/2.5 l". */
function goalText(g: DayGoal): string {
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
 * Under the day poster: the logging streak as a ruled strip of the last 14 days (ink when logged,
 * hatched when a freeze covered it), the run in Figure size, how far the next print is, and the day
 * goals as small quarter arcs. Logging the day's first food stamps today's cell; closing every goal
 * sweeps a Done Green rule under the band.
 */
export function StreakBand({ game }: { game: GameState }) {
  const { streak, day_goals: goals } = game;
  const stamped = useBecame(streak.today_logged, true);
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

  const toNext = streak.next_milestone - streak.current;
  const prevMilestone = [0, 7, 30, 100, 200, 365].filter((m) => m <= streak.current).pop() ?? 0;
  const span = Math.max(1, streak.next_milestone - prevMilestone);
  const pct = Math.min(1, (streak.current - prevMilestone) / span);

  return (
    <section aria-label="Streak and day goals" className="relative border-b border-g2 md:col-span-2 lg:col-span-3">
      {game.show_streak && (
        <Link href="/progress" className="group flex items-center gap-4 py-3 transition-colors hover:bg-g1 md:-mx-2 md:px-2" aria-label={`Streak ${streak.current} days. Open progress`}>
          <div className="shrink-0">
            <p className="text-[12px] text-g4">Streak</p>
            <p className="mt-0.5 flex items-baseline gap-1">
              <InkFrame show={stamped}>
                <RollingNumber value={streak.current} className="text-[22px] font-medium text-ink" />
              </InkFrame>
              <span className="text-[12px] text-g4">{streak.current === 1 ? "day" : "days"}</span>
            </p>
          </div>
          <div className="min-w-0 flex-1">
            {/* The last 14 days, today last */}
            <ol className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-[3px] md:flex md:gap-1" aria-label="Last 14 days">
              {streak.strip.map((d, i) => {
                const isToday = i === streak.strip.length - 1;
                return (
                  <li
                    key={d.date}
                    title={d.date}
                    aria-label={`${d.date}: ${d.state === "pending" ? "not logged yet" : d.state}`}
                    className={`aspect-square md:size-5 ${
                      d.state === "logged"
                        ? `bg-ink ${isToday && stamped ? "animate-stamp" : ""}`
                        : d.state === "freeze"
                          ? "hatch border border-g3"
                          : d.state === "pending"
                            ? "border border-g4"
                            : "bg-g2"
                    }`}
                  />
                );
              })}
            </ol>
            <div className="mt-2 flex flex-col gap-1.5">
              <span className="relative block h-[3px] bg-g2" aria-hidden="true">
                <span className="absolute inset-y-0 left-0 origin-left animate-bar bg-g5 transition-[width] duration-(--dur-draw) ease-(--ease-out)" style={{ width: `${pct * 100}%` }} />
              </span>
              <span className="truncate text-[12px] tabular-nums text-g4">
                {streak.current === 0 ? (
                  streak.longest > 0 ? `Longest ${streak.longest} days` : "Log today to start"
                ) : (
                  <span className={toNext <= 3 ? "text-ink" : ""}>
                    {toNext} {toNext === 1 ? "day" : "days"} to the {streak.next_milestone} day print
                  </span>
                )}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1" aria-label={`${streak.freezes_banked} freezes banked`} title="Freezes keep your streak through a missed day">
            {Array.from({ length: streak.freezes_max }, (_, i) => (
              <span key={i} className={`block size-2.5 ${i < streak.freezes_banked ? "hatch border border-g4" : "border border-g2"}`} />
            ))}
            <ChevronRight className="ml-1 h-4 w-4 text-g4 transition-colors group-hover:text-ink" aria-hidden="true" />
          </div>
        </Link>
      )}

      {goals.length > 0 && (
        <div
          className={`grid divide-x divide-g2 ${game.show_streak ? "border-t border-g2" : ""}`}
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
