"use client";

import Link from "next/link";
import { useState } from "react";
import { firstTime } from "@/lib/seen-once";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ErrorState } from "@/components/ui/error-state";
import { useGame } from "@/hooks/game";
import { getErrorMessage } from "@/lib/api";
import { AREA_LABEL, AREA_ORDER } from "@/lib/game";
import { PrintTile, earnedRuns } from "@/components/game/print-tile";
import { YearGrid } from "@/components/game/year-grid";
import { QuestsCard } from "@/components/game/quests-card";
import { RollingNumber } from "@/components/game/rolling-number";
import { RestartStreak } from "@/components/game/streak-controls";
import type { Print } from "@/lib/game-types";

/** Progress: how many prints are on the wall (the one big number), the streak, the year, the wall. */
export default function ProgressPage() {
  const { data: game, isError, error, refetch, isLoading } = useGame();
  // The wall ripples in the first time this device shows these prints; after that it is just there.
  const [ripple] = useState(() => typeof window !== "undefined");

  if (isError && !game) {
    return (
      <DashboardLayout title="Progress" backHref="/today" backLabel="Back to today">
        <ErrorState message={getErrorMessage(error, "Couldn't load your progress.")} onRetry={() => refetch()} />
      </DashboardLayout>
    );
  }
  if (isLoading || !game) {
    return (
      <DashboardLayout title="Progress" backHref="/today" backLabel="Back to today">
        <div className="space-y-px" aria-busy="true">
          <div className="h-40 animate-pulse bg-g1" />
          <div className="h-64 animate-pulse bg-g1" />
        </div>
      </DashboardLayout>
    );
  }

  if (!game.enabled) {
    return (
      <DashboardLayout title="Progress" backHref="/today" backLabel="Back to today">
        <p className="max-w-md text-[15px] text-g5">
          Streaks, prints and quests are switched off. Turn them on in{" "}
          <Link href="/settings/app" className="text-ink underline underline-offset-4">Settings, App</Link>.
        </p>
      </DashboardLayout>
    );
  }

  const earned = game.prints.filter((p) => earnedRuns(p).length > 0);
  const runsEarned = game.prints.reduce((n, p) => n + earnedRuns(p).length, 0);
  const latest = game.prints
    .flatMap((p) => earnedRuns(p).map((r) => ({ p, r })))
    .sort((a, b) => (a.r.earned_at! < b.r.earned_at! ? 1 : -1))[0];
  const byArea = new Map<string, Print[]>();
  for (const p of game.prints) byArea.set(p.area, [...(byArea.get(p.area) ?? []), p]);
  let tileIndex = 0;
  const earnedKey = game.prints.map((p) => `${p.key}${earnedRuns(p).length}`).join();
  const showRipple = ripple && firstTime("wall", earnedKey);

  return (
    <DashboardLayout title="Progress" backHref="/today" backLabel="Back to today">
      {/* The screen's question: how much is on the wall */}
      <section className="flex items-end justify-between gap-4 border-b border-g2 pb-4">
        <div>
          <p className="text-[6.5rem] leading-[0.8] font-bold tracking-[-0.045em] tabular-nums text-ink sm:text-[8.5rem]">
            <RollingNumber value={earned.length} />
          </p>
          <p className="mt-3 text-[13px] text-g5">
            <span className="text-ink">of {game.prints.length} prints</span>, {runsEarned} editions in all
          </p>
        </div>
        {latest && (
          <p className="max-w-[45%] text-right text-[12px] text-g4">
            Latest
            <span className="block text-[13px] text-ink">{latest.p.title}</span>
          </p>
        )}
      </section>

      {/* Streak and weigh-in rhythm in Figure size */}
      <section className="grid grid-cols-3 divide-x divide-g2 border-b border-g2" aria-label="Streak">
        {[
          { label: "Streak", value: game.streak.current, unit: "days" },
          { label: "Longest", value: game.streak.longest, unit: "days" },
          game.weight
            ? { label: "Weigh-in weeks", value: game.weight.weigh_in_weeks_current, unit: "in a row" }
            : { label: "Freezes", value: game.streak.freezes_banked, unit: `of ${game.streak.freezes_max}` },
        ].map((c, i) => (
          <div key={c.label} className={`py-3.5 ${i === 0 ? "pr-3" : "px-3"}`}>
            <p className="text-[12px] text-g4">{c.label}</p>
            <p className="mt-1 whitespace-nowrap">
              <span className="text-[22px] font-medium tabular-nums text-ink">{c.value}</span>
              <span className="ml-1 text-[12px] text-g4">{c.unit}</span>
            </p>
          </div>
        ))}
      </section>

      <RestartStreak game={game} />

      <div className="mt-4 grid gap-4 lg:grid-cols-3 lg:items-start">
        <section className="clay-card min-w-0 p-5 lg:col-span-2" aria-label="The last year">
          <h2 className="mb-3 text-[15px] font-medium text-ink">The last year</h2>
          <YearGrid year={game.year} />
        </section>
        <QuestsCard game={game} className="min-w-0" />
      </div>

      {/* The wall: one grid, each area headed by a ruled label that spans the row */}
      <section aria-label="Prints" className="mt-6">
        <h2 className="mb-1 text-[15px] font-medium text-ink">Prints</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-x-4 gap-y-4 px-1.5 lg:grid-cols-[repeat(auto-fill,minmax(132px,1fr))]">
          {AREA_ORDER.filter((a) => byArea.has(a)).flatMap((area) => {
            const prints = byArea.get(area)!;
            const got = prints.filter((p) => earnedRuns(p).length > 0).length;
            return [
              <div key={`h-${area}`} className="col-span-full -mx-1.5 mt-3 flex items-baseline justify-between border-t border-g2 pt-2">
                <h3 className="text-[12px] text-g4">{AREA_LABEL[area]}</h3>
                <span className="text-[12px] tabular-nums text-g4">{got} of {prints.length}</span>
              </div>,
              ...prints.map((p) => <PrintTile key={p.key} print={p} ripple={showRipple} delay={Math.min(tileIndex++ * 30, 600)} />),
            ];
          })}
        </div>
      </section>
      <p className="mt-8 text-[12px] text-g4">
        Prints reward logging and consistency, never eating less. Tap a print to turn it over.
      </p>
    </DashboardLayout>
  );
}
