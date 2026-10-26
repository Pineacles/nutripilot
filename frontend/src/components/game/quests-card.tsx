"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DoneCheck } from "./goal-arc";
import { useSwapQuest } from "@/hooks/game";
import { getErrorMessage } from "@/lib/api";
import { areaInk } from "@/lib/game";
import type { GameState } from "@/lib/game-types";

/**
 * This week's three quests as ruled rows: the task, a scale bar in its area's ink and the count. A
 * finished quest draws a Done Green check. One quest a week can be swapped for another.
 */
export function QuestsCard({ game, className = "", band = false }: { game: GameState; className?: string; band?: boolean }) {
  // On Today the quests read as a band under the poster: three columns from 768px, no swapping (that
  // lives on Progress), so the week's task sits right under the streak.
  const { items } = game.quests;
  const swap_available = game.quests.swap_available && !band;
  const swap = useSwapQuest();
  const [lastDone, setLastDone] = useState(() => items.filter((q) => q.done).map((q) => q.id).join());
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const doneIds = items.filter((q) => q.done).map((q) => q.id);
  if (doneIds.join() !== lastDone) {
    const before = new Set(lastDone.split(","));
    setFresh(new Set(doneIds.filter((id) => !before.has(id))));
    setLastDone(doneIds.join());
  }
  if (items.length === 0) return null;
  const done = doneIds.length;

  return (
    <section className={`${band ? "border-b border-g2 pt-3 pb-1 max-md:border-b-0" : "clay-card p-5"} ${className}`} aria-label="This week's quests">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-medium text-ink">This week</h3>
        <span className="text-[13px] tabular-nums text-g4">{done} of {items.length} done</span>
      </div>
      <ul className={band ? "md:grid md:grid-cols-3 md:gap-x-6" : ""}>
        {items.map((q) => {
          const pct = q.target > 0 ? Math.min(1, q.progress / q.target) : 0;
          return (
            <li key={q.id} className={`border-t border-g2 py-3 ${fresh.has(q.id) ? "animate-lit" : ""}`}>
              <div className="flex items-center gap-3">
                <p className={`min-w-0 flex-1 text-[15px] ${q.done ? "text-ink" : "text-g5"}`}>{q.title}</p>
                {q.done ? (
                  <DoneCheck animate={fresh.has(q.id)} size={18} />
                ) : (
                  <span className="text-[13px] tabular-nums text-g4">
                    {Math.min(q.progress, q.target)}/{q.target}
                  </span>
                )}
                {swap_available && !q.done && (
                  <button
                    type="button"
                    disabled={swap.isPending}
                    onClick={() =>
                      swap.mutate(q.id, {
                        onSuccess: (n) => toast.success(`Swapped for "${n.title}"`),
                        onError: (e) => toast.error(getErrorMessage(e)),
                      })
                    }
                    className="h-11 shrink-0 rounded-full border border-g3 px-4 text-[13px] text-ink transition-colors hover:border-g5 disabled:text-g4"
                  >
                    Swap
                  </button>
                )}
              </div>
              <span className="mt-2 block h-[3px] bg-g2" aria-hidden="true">
                <span
                  className="block h-full origin-left animate-bar transition-[width] duration-(--dur-draw) ease-(--ease-out) motion-reduce:transition-none"
                  style={{ width: `${pct * 100}%`, background: areaInk(q.area) }}
                />
              </span>
            </li>
          );
        })}
      </ul>
      {swap_available && <p className="mt-2 text-[12px] text-g4">You can swap one quest this week.</p>}
    </section>
  );
}
