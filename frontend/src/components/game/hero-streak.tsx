"use client";

import { useState } from "react";
import Link from "next/link";
import { RollingNumber } from "./rolling-number";
import { InkFrame } from "./ink-frame";
import type { GameState } from "@/lib/game-types";

/** Say once when a value turns into `to` while mounted (not on first render). */
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
 * The logging streak in the day poster's hero, top left above the kcal figure: the run in a large
 * Figure, then the last 14 days as small square cells (ink logged, hatched freeze, g2 missed, a g4
 * outline for today still open). Logging the first food of the day stamps today's cell and opens an
 * ink frame around the figure. Tap for Progress.
 */
export function HeroStreak({ game }: { game: GameState }) {
  const { streak } = game;
  const stamped = useBecame(streak.today_logged, true);
  const toNext = streak.next_milestone - streak.current;
  const restart = streak.restart_from;
  const restartedToday = restart === game.today;

  return (
    <Link href="/progress" aria-label={`Streak ${streak.current} days, open progress`} className="group block rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">
      <p className="flex items-baseline gap-1.5 leading-none">
        <InkFrame show={stamped}>
          <RollingNumber value={streak.current} className="text-[28px] font-semibold tracking-[-0.02em] text-ink" />
        </InkFrame>
        <span className="text-[13px] text-g5 transition-colors group-hover:text-ink">day streak</span>
      </p>
      <ol className="mt-2.5 flex gap-[2px]" aria-label="Last 14 days">
        {streak.strip.map((d, i) => {
          const isToday = i === streak.strip.length - 1;
          // Days before a restart belong to the old streak: set one step down so the count reads true.
          const old = !!restart && d.date < restart;
          return (
            <li
              key={d.date}
              title={d.date}
              className={`size-[7px] min-[400px]:size-2 sm:size-2.5 ${
                old
                  ? d.state === "logged" || d.state === "freeze" ? "bg-g3" : "bg-g2"
                  : d.state === "logged"
                  ? `bg-ink ${isToday && stamped ? "animate-stamp" : ""}`
                  : d.state === "freeze"
                    ? "hatch"
                    : d.state === "pending"
                      ? "border border-g4"
                      : "bg-g2"
              }`}
            />
          );
        })}
        <li aria-hidden="true" className="w-1.5" />
        {Array.from({ length: streak.freezes_max }, (_, i) => (
          <li
            key={`f${i}`}
            title="Freezes keep the streak through a missed day"
            className={`size-[7px] min-[400px]:size-2 sm:size-2.5 ${i < streak.freezes_banked ? "hatch border border-g4" : "border border-g2"}`}
          />
        ))}
      </ol>
      <p className="mt-2 text-[12px] leading-snug tabular-nums text-g4">
        {restartedToday && streak.current <= 1 ? "Restarted today. " : ""}
        {streak.current === 0
          ? streak.longest > 0
            ? `Longest ${streak.longest} days. Log today to start again.`
            : "Log today to start a streak."
          : `${toNext} ${toNext === 1 ? "day" : "days"} to the ${streak.next_milestone} day print`}
      </p>
    </Link>
  );
}
