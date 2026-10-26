"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useGame, useMarkSeen } from "@/hooks/game";
import { ROMAN, areaInk, buzz } from "@/lib/game";
import { fmtDate } from "@/lib/chart-utils";
import { CropMarks, PrintTile, printMark } from "./print-tile";
import { throwPaper } from "./confetti";
import { setCelebrating } from "@/lib/game-stage";
import type { GameState, Print, UnseenItem } from "@/lib/game-types";

const itemId = (u: UnseenItem) => `${u.kind}:${u.key}:${u.run ?? ""}:${u.date}`;

/** Counts from 0 to the print's number while the print is pulled; still under reduced motion. */
function CountIn({ to, delay }: { to: number; delay: number }) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const timer = setTimeout(() => {
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / 700);
        setV(Math.round(to * (1 - Math.pow(1 - p, 4))));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [to, delay, reduce]);
  return <>{v}</>;
}

/**
 * The one authored moment: a new print is pulled through the screen. Crop marks register the sheet,
 * a squeegee line wipes across and leaves the print behind, the numeral counts up, and for the big
 * runs square paper flies in the print's own ink.
 */
function PrintReveal({ item, print, step, total, onNext }: { item: UnseenItem; print: Print | undefined; step: number; total: number; onNext: () => void }) {
  const reduce = useReducedMotion();
  const ink = areaInk(item.area);
  const run = print?.runs.find((r) => r.run === item.run);
  const numeral = run?.threshold ?? null;
  const mark = print ? printMark(print, ink) : null;
  const next = print?.runs.find((r) => !r.earned_at && (item.run == null || r.run > item.run));

  useEffect(() => {
    const t1 = setTimeout(() => buzz(item.big ? [30, 60, 30, 60, 90] : [30, 50, 30]), 350);
    const t2 = item.big
      ? setTimeout(() => throwPaper(item.key === "full_plate" ? ["var(--protein)", "var(--carbs)", "var(--fat)", "var(--fiber)", "var(--water)", "var(--ink)"] : [ink, "var(--ink)", "var(--g5)"], true), 700)
      : null;
    return () => {
      clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, [item, ink]);

  const rise = (delay: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduce ? 0.15 : 0.35, delay: reduce ? 0 : delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="flex flex-col items-center pt-4 text-center">
        <div className="relative w-[62%] max-w-[220px]">
          <CropMarks animate />
          <div className="relative aspect-square overflow-hidden">
            <div className="absolute inset-0 flex flex-col justify-between bg-g0 p-4 text-left animate-print" style={{ animationDelay: "180ms" }}>
              {mark ?? (
                <span className="block text-[5.5rem] leading-[0.8] font-bold tracking-[-0.05em] tabular-nums" style={{ color: ink }}>
                  {numeral != null ? <CountIn to={numeral} delay={260} /> : ""}
                </span>
              )}
              <span className="flex items-end justify-between">
                <span className="text-[12px] text-g4">{print?.unit ?? ""}</span>
                {item.run != null && (print?.runs.length ?? 0) > 1 && (
                  <span className="text-[13px] font-medium" style={{ color: ink }}>{ROMAN[item.run] ?? item.run}</span>
                )}
              </span>
            </div>
            {/* The squeegee: a g5 line pulled across, leaving the print behind it */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-full animate-squeegee" style={{ animationDelay: "180ms" }}>
              <span className="absolute inset-y-0 right-0 w-[3px] bg-g5" />
            </span>
          </div>
        </div>
        <m.div {...rise(0.75)}>
          <DialogTitle className="mt-6 text-[22px] font-semibold tracking-[-0.01em]">{item.title}</DialogTitle>
        </m.div>
        <m.div {...rise(0.85)}>
          <DialogDescription className="mt-1 text-[15px] text-g5">{item.description}</DialogDescription>
          <p className="mt-1 text-[12px] tabular-nums text-g4">Earned {fmtDate(item.date)}</p>
        </m.div>
        {next && (
          <m.p {...rise(0.95)} className="mt-4 text-[13px] text-g4">
            Next print at {next.threshold} {print?.unit}
          </m.p>
        )}
        <m.div {...rise(1.05)} className="mt-6 w-full">
          <Button size="lg" className="h-12 w-full" onClick={onNext} autoFocus>
            {step < total ? `Next print (${step} of ${total})` : "Continue"}
          </Button>
        </m.div>
      </div>
    </LazyMotion>
  );
}

/** First visit after the feature arrives: history already earned prints; show them once, together. */
function BackfillSheet({ items, prints, onClose }: { items: UnseenItem[]; prints: Print[]; onClose: () => void }) {
  const keys = new Set(items.map((i) => i.key));
  const shown = prints.filter((p) => keys.has(p.key));
  useEffect(() => {
    const t = setTimeout(() => throwPaper(["var(--ink)", "var(--protein)", "var(--fiber)", "var(--water)"], false), 500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="pt-2">
      <DialogTitle className="text-[22px] font-semibold tracking-[-0.01em]">
        You already earned {items.length} print{items.length === 1 ? "" : "s"}
      </DialogTitle>
      <DialogDescription className="mt-1 text-[15px] text-g5">
        Your logging history counts. From now on each new print gets its own moment.
      </DialogDescription>
      <div className="mt-5 grid max-h-[50dvh] grid-cols-3 gap-4 overflow-y-auto p-2 sm:grid-cols-4">
        {shown.map((p, i) => (
          <PrintTile key={p.key} print={p} delay={Math.min(i * 45, 700)} raised />
        ))}
      </div>
      <Button size="lg" className="mt-5 h-12 w-full" onClick={onClose}>
        See all prints later in Progress
      </Button>
    </div>
  );
}

/**
 * Watches the game state for things not seen yet and gives each its due: prints a sheet (or a toast
 * when celebrations are quiet), quests and freezes a toast. Everything is marked seen once shown.
 */
export function Celebration() {
  const { data: game } = useGame();
  const markSeen = useMarkSeen();
  const handled = useRef(new Set<string>());
  const [queue, setQueue] = useState<UnseenItem[]>([]);
  const [backfill, setBackfill] = useState<UnseenItem[]>([]);
  const [step, setStep] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!game?.enabled || game.unseen.length === 0) return;
    const fresh = game.unseen.filter((u) => !handled.current.has(itemId(u)));
    if (fresh.length === 0) return;
    fresh.forEach((u) => handled.current.add(itemId(u)));
    handle(game, fresh);
    // handle only reads its arguments and stable setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  function handle(g: GameState, fresh: UnseenItem[]) {
    const prints = fresh.filter((u) => u.kind === "print");
    const quests = fresh.filter((u) => u.kind === "quest");
    const freezes = fresh.filter((u) => u.kind === "freeze");
    if (g.celebrations === "off") {
      markSeen.mutate({ all: true });
      return;
    }
    for (const q of quests) {
      buzz(25);
      toast.success(`Quest done: ${q.title}`);
    }
    if (quests.length) markSeen.mutate({ quests: quests.map((q) => q.id).filter((id): id is string => !!id) });
    if (freezes.length) {
      const last = freezes.map((f) => f.date).sort().pop()!;
      toast(`A freeze kept your ${g.streak.current} day streak going`, {
        description: `${g.streak.freezes_banked} of ${g.streak.freezes_max} freezes left. You earn one every 7 logged days.`,
      });
      markSeen.mutate({ freezes_through: last });
    }
    const old = prints.filter((p) => p.backfill);
    const fresh_ = prints.filter((p) => !p.backfill);
    if (old.length) setBackfill(old);
    if (fresh_.length) {
      if (g.celebrations === "quiet") {
        for (const p of fresh_) toast.success(`New print: ${p.title}`);
        markSeen.mutate({ prints: fresh_.map((p) => ({ key: p.key, run: p.run })) });
      } else {
        setQueue((q) => [...q, ...fresh_]);
        setTotal((t) => t + fresh_.length);
        setStep((s) => (s === 0 ? 1 : s));
      }
    }
  }

  const current = backfill.length ? null : queue[0];
  const showing = backfill.length > 0 || !!current;
  useEffect(() => {
    setCelebrating(showing);
  }, [showing]);

  function closeBackfill() {
    markSeen.mutate({ prints: backfill.map((p) => ({ key: p.key, run: p.run })) });
    setBackfill([]);
  }

  function next() {
    if (!current) return;
    markSeen.mutate({ prints: [{ key: current.key, run: current.run }] });
    setQueue((q) => q.slice(1));
    if (queue.length <= 1) {
      setStep(0);
      setTotal(0);
    } else {
      setStep((s) => s + 1);
    }
  }

  if (!game) return null;
  return (
    <>
      <Dialog open={backfill.length > 0} onOpenChange={(o) => !o && closeBackfill()}>
        <DialogContent className="sm:max-w-md">
          {backfill.length > 0 && <BackfillSheet items={backfill} prints={game.prints} onClose={closeBackfill} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!current} onOpenChange={(o) => !o && next()}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          {current && (
            <PrintReveal
              key={itemId(current)}
              item={current}
              print={game.prints.find((p) => p.key === current.key)}
              step={step}
              total={total}
              onNext={next}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
