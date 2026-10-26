"use client";

import { toast } from "sonner";
import { Switch } from "@/components/settings/nutrients-content";
import { useRestartStreak, useSetDayCounts } from "@/hooks/game";
import { getErrorMessage } from "@/lib/api";
import { fmtDate } from "@/lib/chart-utils";
import type { GameState } from "@/lib/game-types";

/**
 * Start the streak fresh from today, for when the run doesn't feel earned. Prints and the longest
 * streak keep their history. Undo instead of a confirm, like everywhere else in the app.
 */
export function RestartStreak({ game }: { game: GameState }) {
  const restart = useRestartStreak();
  const restartedToday = game.streak.restart_from === game.today;

  function run() {
    restart.mutate(game.today, {
      onSuccess: (r) =>
        toast("Streak restarted", {
          description: "It counts from today. Your prints and longest streak stay.",
          action: { label: "Undo", onClick: () => restart.mutate(r.previous) },
        }),
      onError: (e) => toast.error(getErrorMessage(e)),
    });
  }

  return (
    <div className="flex min-h-[60px] items-center justify-between gap-3 border-b border-g2 py-2">
      <div className="min-w-0">
        <p className="text-[15px] text-ink">Restart streak</p>
        <p className="text-[12px] text-g4">
          {game.streak.restart_from
            ? `Counting from ${fmtDate(game.streak.restart_from)}.`
            : "Start fresh from today when the run doesn't feel right. Prints stay."}
        </p>
      </div>
      <button
        type="button"
        onClick={run}
        disabled={restart.isPending || restartedToday}
        className="h-11 shrink-0 rounded-full border border-g3 px-4 text-[13px] text-ink transition-colors hover:border-g5 disabled:text-g4 disabled:hover:border-g3"
      >
        {restartedToday ? "Restarted today" : "Restart"}
      </button>
    </div>
  );
}

/**
 * On a day with food logged: whether it counts for the streak. Turned off it is treated as a missed
 * day (a freeze can still cover it), for days where not everything eaten made it into the log.
 */
export function DayCountsRow({ game, date }: { game: GameState; date: string }) {
  const setCounts = useSetDayCounts();
  const counts = !game.streak.excluded_days.includes(date);
  const beforeRestart = !!game.streak.restart_from && date < game.streak.restart_from;
  if (beforeRestart) return null;

  return (
    <div className="mt-4 flex min-h-[60px] items-center gap-3 border-t border-b border-g2 md:col-span-2 lg:col-span-3">
      <div className="min-w-0 flex-1">
        <p className={`text-[15px] ${counts ? "text-ink" : "text-g5"}`}>Count this day for the streak</p>
        <p className="text-[12px] text-g4">
          {counts ? "Turn off if not everything you ate is logged." : "Not counted, like a missed day. A freeze may still cover it."}
        </p>
      </div>
      <Switch
        on={counts}
        label="Count this day for the streak"
        onToggle={() =>
          setCounts.mutate(
            { day: date, counts: !counts },
            { onError: (e) => toast.error(getErrorMessage(e)) },
          )
        }
      />
    </div>
  );
}
