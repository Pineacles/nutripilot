"use client";

import { useEffect, useState } from "react";
import { LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMarkRecapSeen, useRecap } from "@/hooks/game";
import { addDays, parseLocal } from "@/lib/dates";
import { fmtDate } from "@/lib/chart-utils";
import { areaInk } from "@/lib/game";
import { useCelebrating } from "@/lib/game-stage";

function weekLabel(start: string): string {
  const fmt = (d: string) => parseLocal(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${fmt(start)} to ${fmt(addDays(start, 6))}`;
}

const signed = (n: number, digits = 1) => `${n > 0 ? "+" : n < 0 ? "-" : ""}${Math.abs(n).toFixed(digits)}`;

interface Props {
  week: string;
  /** Open on its own after any print sheets (celebrations full or quiet). Off: only when asked. */
  auto: boolean;
}

/**
 * Monday's look back at last week, set as one poster: the week's seven days stamp in one after
 * another (logged in ink, a closed day with a Done Green rule under it), then the rows rule in.
 * The one orchestrated sequence in the app. With celebrations off it waits behind a quiet row.
 */
export function RecapSheet({ week, auto }: Props) {
  const [open, setOpen] = useState(false);
  const { data: recap } = useRecap(week);
  const seen = useMarkRecapSeen();
  const reduce = useReducedMotion();
  const celebrating = useCelebrating();

  // Print sheets from the same visit go first; the recap follows a moment after the last one.
  useEffect(() => {
    if (!auto || !recap || celebrating || open) return;
    const t = setTimeout(() => setOpen(true), 1600);
    return () => clearTimeout(t);
  }, [auto, recap, celebrating, open]);

  function close() {
    setOpen(false);
    seen.mutate(week);
  }

  if (!recap) return null;
  const rows: { label: string; value: string; ink?: string; sub?: string }[] = [
    ...(recap.window_days != null ? [{ label: "Calorie window", value: `${recap.window_days} of 7 days`, sub: "At or under your target, not below 1000 kcal" }] : []),
    ...(recap.closed_days != null ? [{ label: "Days closed", value: `${recap.closed_days} of 7` }] : []),
    ...(recap.quests.length ? [{ label: "Quests", value: `${recap.quests.filter((q) => q.done).length} of ${recap.quests.length}`, sub: recap.quests.map((q) => `${q.done ? "Done" : "Open"}: ${q.title}`).join("; ") }] : []),
    // Weight shows only when the trend went the way of the goal (or there is no goal): no wrong-way messages.
    ...(recap.trend_change != null && recap.trend_toward_goal !== false
      ? [{ label: "Trend weight", value: `${signed(recap.trend_change)} kg`, sub: recap.trend_end != null ? `${recap.trend_end.toFixed(1)} kg, ${recap.weigh_in_days} weigh-ins` : undefined }]
      : []),
    { label: "Different foods", value: String(recap.distinct_foods), ink: areaInk("variety"), sub: recap.most_varied_day ? `Most varied ${fmtDate(recap.most_varied_day.date)}, ${recap.most_varied_day.value} foods` : undefined },
    ...(recap.best_protein_day ? [{ label: "Best protein day", value: `${Math.round(recap.best_protein_day.value)} g`, ink: "var(--protein)", sub: fmtDate(recap.best_protein_day.date) }] : []),
    ...(recap.water_target_days != null ? [{ label: "Water target", value: `${recap.water_target_days} of 7 days`, ink: "var(--water)" }] : []),
    { label: "Streak on Sunday", value: `${recap.streak_at_end} ${recap.streak_at_end === 1 ? "day" : "days"}` },
  ];
  const rule = (i: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduce ? 0.15 : 0.3, delay: reduce ? 0 : 0.45 + i * 0.05, ease: [0.16, 1, 0.3, 1] as const },
  });
  const days = recap.days?.length === 7 ? recap.days : Array.from({ length: 7 }, (_, i) => ({ date: addDays(recap.week_start, i), logged: i < recap.logged_days, closed: false }));

  return (
    <>
      {!auto && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 flex min-h-[60px] w-full items-center justify-between gap-3 border-t border-b border-g2 text-left transition-colors hover:bg-g1"
        >
          <span className="text-[15px] text-ink">Your week is ready</span>
          <span className="text-[13px] text-g4">{weekLabel(recap.week_start)}</span>
        </button>
      )}
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
          <LazyMotion features={domAnimation} strict>
            <div>
              <DialogTitle className="text-[22px] font-semibold tracking-[-0.01em]">Your week</DialogTitle>
              <DialogDescription className="text-[13px] text-g4">{weekLabel(recap.week_start)}</DialogDescription>
              <div className="mt-4 flex items-end gap-4 border-b border-g2 pb-4">
                <p className="text-[4rem] leading-[0.8] font-bold tracking-[-0.04em] tabular-nums text-ink">{recap.logged_days}</p>
                <div className="min-w-0 flex-1 pb-1">
                  <p className="text-[13px] text-g5">days logged</p>
                  <ol className="mt-2 grid grid-cols-7 gap-1 overflow-hidden p-0.5" aria-label={`${recap.logged_days} of 7 days logged`}>
                    {days.map((d, i) => (
                      <li key={d.date} className="flex flex-col gap-0.5">
                        <span
                          className={`block aspect-square ${d.logged ? "bg-ink animate-stamp" : "bg-g2"}`}
                          style={d.logged ? { animationDelay: `${150 + i * 60}ms` } : undefined}
                        />
                        <span className={`block h-0.5 ${d.closed ? "bg-done" : ""}`} />
                        <span className="text-center text-[10px] text-g4">{parseLocal(d.date).toLocaleDateString("en-GB", { weekday: "narrow" })}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
              <ul>
                {rows.map((r, i) => (
                  <m.li key={r.label} {...rule(i)} className="flex min-h-[52px] items-center justify-between gap-3 border-b border-g2 py-2">
                    <div className="min-w-0">
                      <p className="text-[15px] text-ink">{r.label}</p>
                      {r.sub && <p className="truncate text-[12px] text-g4">{r.sub}</p>}
                    </div>
                    <span className="shrink-0 text-[17px] font-medium tabular-nums" style={{ color: r.ink ?? "var(--ink)" }}>{r.value}</span>
                  </m.li>
                ))}
                {recap.prints.map((p, i) => (
                  <m.li key={`${p.key}-${p.run}`} {...rule(rows.length + i)} className="flex min-h-[52px] items-center justify-between gap-3 border-b border-g2 py-2">
                    <p className="text-[15px] text-ink">New print</p>
                    <span className="text-[15px]" style={{ color: areaInk(p.area) }}>{p.title}</span>
                  </m.li>
                ))}
              </ul>
              <Button size="lg" className="mt-6 h-12 w-full" onClick={close}>
                Start this week
              </Button>
            </div>
          </LazyMotion>
        </DialogContent>
      </Dialog>
    </>
  );
}
