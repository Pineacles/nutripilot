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

const signed = (n: number, digits = 1) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(digits)}`;

/**
 * Monday's look back at last week, set as one poster: the logged days stamp in one after another,
 * then the week's rows rule in below. The one orchestrated sequence in the app.
 */
export function RecapSheet({ week }: { week: string }) {
  const [open, setOpen] = useState(false);
  const { data: recap } = useRecap(week);
  const seen = useMarkRecapSeen();
  const reduce = useReducedMotion();
  const celebrating = useCelebrating();

  // Print sheets from the same visit go first; the recap follows a moment after the last one.
  useEffect(() => {
    if (!recap || celebrating || open) return;
    const t = setTimeout(() => setOpen(true), 1600);
    return () => clearTimeout(t);
  }, [recap, celebrating, open]);

  function close() {
    setOpen(false);
    seen.mutate(week);
  }

  if (!recap) return null;
  const rows: { label: string; value: string; ink?: string; sub?: string }[] = [
    { label: "Days closed", value: `${recap.closed_days} of 7` },
    ...(recap.quests.length ? [{ label: "Quests", value: `${recap.quests.filter((q) => q.done).length} of ${recap.quests.length}`, sub: recap.quests.map((q) => `${q.done ? "Done" : "Open"}: ${q.title}`).join("; ") }] : []),
    ...(recap.trend_change != null ? [{ label: "Trend weight", value: `${signed(recap.trend_change)} kg`, sub: recap.trend_end != null ? `${recap.trend_end.toFixed(1)} kg, ${recap.weigh_in_days} weigh-ins` : undefined }] : []),
    { label: "Different foods", value: String(recap.distinct_foods), ink: areaInk("variety"), sub: recap.most_varied_day ? `Most varied ${fmtDate(recap.most_varied_day.date)}, ${recap.most_varied_day.value} foods` : undefined },
    ...(recap.best_protein_day ? [{ label: "Best protein day", value: `${Math.round(recap.best_protein_day.value)} g`, ink: "var(--protein)", sub: fmtDate(recap.best_protein_day.date) }] : []),
    { label: "Water target", value: `${recap.water_target_days} of 7 days`, ink: "var(--water)" },
    { label: "Streak at the end", value: `${recap.streak_at_end} days` },
  ];
  const rule = (i: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduce ? 0.15 : 0.3, delay: reduce ? 0 : 0.45 + i * 0.05, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <LazyMotion features={domAnimation} strict>
          <div>
            <DialogTitle className="text-[22px] font-semibold tracking-[-0.01em]">Your week</DialogTitle>
            <DialogDescription className="text-[13px] text-g4">{weekLabel(recap.week_start)}</DialogDescription>
            <div className="mt-4 flex items-end gap-4 border-b border-g2 pb-4">
              <p className="text-[4rem] leading-[0.8] font-bold tracking-[-0.04em] tabular-nums text-ink">{recap.logged_days}</p>
              <div className="flex-1 pb-1">
                <p className="text-[13px] text-g5">days logged</p>
                <ol className="mt-2 grid grid-cols-7 gap-1" aria-hidden="true">
                  {Array.from({ length: 7 }, (_, i) => (
                    <li
                      key={i}
                      className={`aspect-square ${i < recap.logged_days ? "bg-ink animate-stamp" : "bg-g2"}`}
                      style={{ animationDelay: `${200 + i * 70}ms` }}
                    />
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
            </ul>
            {recap.prints.length > 0 && (
              <m.div {...rule(rows.length)} className="mt-4">
                <p className="text-[12px] text-g4">New prints</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {recap.prints.map((p) => (
                    <li key={`${p.key}-${p.run}`} className="rounded-full border border-g3 px-3 py-1.5 text-[13px]" style={{ color: areaInk(p.area) }}>
                      {p.title}
                    </li>
                  ))}
                </ul>
              </m.div>
            )}
            <Button size="lg" className="mt-6 h-12 w-full" onClick={close}>
              Start this week
            </Button>
          </div>
        </LazyMotion>
      </DialogContent>
    </Dialog>
  );
}
