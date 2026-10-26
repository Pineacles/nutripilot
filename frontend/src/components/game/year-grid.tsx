"use client";

import { useEffect, useRef, useState } from "react";
import { parseLocal } from "@/lib/dates";
import type { GameState } from "@/lib/game-types";

const LEVEL_CLASS = ["bg-g2", "bg-g4", "bg-g5", "bg-ink"];
const LEVEL_WORD = ["nothing logged", "logged", "a day goal done", "day closed"];

/**
 * The year as a Swiss calendar: one square per day in weeks of seven, brighter the more complete the
 * day was. It ripples in diagonally the first time it scrolls into view.
 */
export function YearGrid({ year }: { year: GameState["year"] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (year.length === 0) return null;
  // Columns are weeks starting Monday; pad the first week so rows are weekdays.
  const firstDow = (parseLocal(year[0].date).getDay() + 6) % 7;
  const cells: (GameState["year"][number] | null)[] = [...Array(firstDow).fill(null), ...year];
  const weeks = Math.ceil(cells.length / 7);
  const logged = year.filter((d) => d.level > 0).length;
  const closed = year.filter((d) => d.level === 3).length;
  const months: { col: number; label: string }[] = [];
  cells.forEach((c, i) => {
    if (c && parseLocal(c.date).getDate() === 1) {
      months.push({ col: Math.floor(i / 7), label: parseLocal(c.date).toLocaleDateString("en-GB", { month: "short" }) });
    }
  });

  return (
    <div ref={ref}>
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[560px]">
          <div className="relative mb-1 h-4 text-[11px] text-g4">
            {months.map((mo) => (
              <span key={`${mo.col}-${mo.label}`} className="absolute" style={{ left: `${(mo.col / weeks) * 100}%` }}>
                {mo.label}
              </span>
            ))}
          </div>
          <div className="grid grid-flow-col grid-rows-7 gap-[2px]" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}>
            {cells.map((c, i) =>
              c ? (
                <span
                  key={c.date}
                  title={`${c.date}: ${LEVEL_WORD[c.level]}`}
                  className={`aspect-square ${LEVEL_CLASS[c.level]} ${seen ? "animate-cell-in" : "opacity-0 motion-reduce:opacity-100"}`}
                  style={seen ? { animationDelay: `${(Math.floor(i / 7) + (i % 7)) * 9}ms` } : undefined}
                />
              ) : (
                <span key={`pad-${i}`} aria-hidden="true" />
              ),
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[12px] text-g4">
        <p className="tabular-nums">
          <span className="text-ink">{logged}</span> days logged, <span className="text-ink">{closed}</span> closed in the last year
        </p>
        <p className="flex items-center gap-1.5" aria-hidden="true">
          Less
          {LEVEL_CLASS.map((c) => <span key={c} className={`block size-2.5 ${c}`} />)}
          More
        </p>
      </div>
    </div>
  );
}
