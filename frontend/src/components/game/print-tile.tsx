"use client";

import { useState } from "react";
import { LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { ROMAN, areaInk } from "@/lib/game";
import { fmtDate } from "@/lib/chart-utils";
import type { Print, PrintArea } from "@/lib/game-types";

/** Printer's crop marks just outside the corners: the print is registered on the sheet. */
export function CropMarks({ animate = false, className = "" }: { animate?: boolean; className?: string }) {
  const corners = [
    "-top-1.5 -left-1.5 border-t border-l",
    "-top-1.5 -right-1.5 border-t border-r",
    "-bottom-1.5 -left-1.5 border-b border-l",
    "-bottom-1.5 -right-1.5 border-b border-r",
  ];
  return (
    <>
      {corners.map((c, i) => (
        <span
          key={c}
          aria-hidden="true"
          className={`pointer-events-none absolute size-2.5 border-g4 ${c} ${animate ? "animate-crop" : ""} ${className}`}
          style={animate ? { animationDelay: `${i * 60}ms` } : undefined}
        />
      ))}
    </>
  );
}

/** Quarter arcs like the day poster's corner, for prints that are about the whole plate. */
function Arcs({ inks }: { inks: string[] }) {
  const S = 100;
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="h-[52%] w-[52%]" fill="none" aria-hidden="true">
      {inks.map((ink, i) => {
        const r = S - 8 - i * 17;
        return <path key={ink} d={`M${S} ${S - r} A${r} ${r} 0 0 0 ${S - r} ${S}`} stroke={ink} strokeWidth={11} />;
      })}
    </svg>
  );
}

/** The drawing for the few prints that have no number, or null when the print shows its numeral. */
export function printMark(print: Pick<Print, "key">, ink: string, muted = false): React.ReactNode {
  if (print.key === "full_plate") {
    const inks = ["var(--ink)", "var(--protein)", "var(--carbs)", "var(--fat)"];
    return <Arcs inks={muted ? inks.map((_, i) => `var(--g${i % 2 ? 2 : 3})`) : inks} />;
  }
  if (print.key === "goal_reached") return <Arcs inks={[ink]} />;
  if (print.key === "comeback") return <span className="text-[2.6em] leading-none font-bold tracking-[-0.04em]" style={{ color: ink }}>+1</span>;
  return null;
}

export function earnedRuns(p: Print) {
  return p.runs.filter((r) => r.earned_at);
}

/** The numeral printed on a print: its best earned run, else the next one to reach. */
export function printNumeral(p: Print): number | null {
  const earned = earnedRuns(p);
  const run = earned.length ? earned[earned.length - 1] : p.runs[0];
  return run ? run.threshold : null;
}

interface Props {
  print: Print;
  /** Delay of the ripple-in when the wall first shows, in ms. */
  delay?: number;
  /** On a g1 sheet (a dialog) the print is set on ground so it still reads as a sheet. */
  raised?: boolean;
  /** Ripple in (the wall's first showing on this device); otherwise it is simply there. */
  ripple?: boolean;
}

/**
 * One print on the wall. Earned: a g1 sheet with the numeral in the area's ink and a mark per run.
 * Not yet: an unprinted plate (g2 outline, g3 numeral) with how far along it is. Tap to turn it over
 * for the dates and what comes next.
 */
export function PrintTile({ print, delay = 0, raised = false, ripple = true }: Props) {
  const sheet = raised ? "bg-g0" : "bg-g1";
  const [flipped, setFlipped] = useState(false);
  const reduce = useReducedMotion();
  const earned = earnedRuns(print);
  const isEarned = earned.length > 0;
  const ink = areaInk(print.area as PrintArea);
  const numeral = printNumeral(print);
  const mark = print.hidden && !isEarned ? null : printMark(print, isEarned ? ink : "var(--g3)", !isEarned);
  const progress = print.progress;
  const pct = progress?.next_threshold ? Math.min(1, progress.value / progress.next_threshold) : 1;
  const multi = print.runs.length > 1;

  return (
    <div className={`relative ${ripple ? "animate-cell-in" : ""}`} style={ripple ? { animationDelay: `${delay}ms` } : undefined}>
      {isEarned && <CropMarks />}
      <LazyMotion features={domAnimation} strict>
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-pressed={flipped}
          aria-label={`${print.title}${isEarned ? ", earned" : ""}. ${print.description}`}
          className="block aspect-square w-full text-left [perspective:800px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <m.span
            className="relative block h-full w-full [transform-style:preserve-3d]"
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Front */}
            <span
              className={`absolute inset-0 flex flex-col justify-between p-2.5 [backface-visibility:hidden] ${
                isEarned ? sheet : "border border-g2"
              }`}
            >
              <span className="block">
                {mark ?? (
                  <span
                    className="block text-[length:clamp(1.4rem,6vw,1.85rem)] leading-[0.85] font-bold tracking-[-0.045em] tabular-nums"
                    style={{ color: isEarned ? ink : "var(--g3)" }}
                  >
                    {print.hidden && !isEarned ? "?" : numeral ?? ""}
                  </span>
                )}
                {!mark && numeral != null && !(print.hidden && !isEarned) && (
                  <span className="mt-0.5 block text-[11px] text-g4">{print.unit}</span>
                )}
              </span>
              <span className="block">
                <span className={`line-clamp-2 block text-[12px] leading-tight ${isEarned ? "text-ink" : "text-g4"}`}>{print.title}</span>
                {multi ? (
                  <span className="mt-1.5 flex gap-1" aria-hidden="true">
                    {print.runs.slice(0, 5).map((r) => (
                      <span key={r.run} className={`block size-1.5 ${r.earned_at ? "" : "border border-g3"}`} style={r.earned_at ? { background: ink } : undefined} />
                    ))}
                  </span>
                ) : null}
                {!isEarned && progress?.next_threshold ? (
                  <span className="mt-1.5 block h-[3px] bg-g2">
                    <span className="block h-full origin-left animate-bar" style={{ width: `${pct * 100}%`, background: "var(--g5)" }} />
                  </span>
                ) : null}
              </span>
            </span>
            {/* Back */}
            <span className={`absolute inset-0 flex flex-col justify-between overflow-hidden ${sheet} p-2.5 [backface-visibility:hidden] [transform:rotateY(180deg)]`}>
              <span className="block text-[11px] leading-snug text-g5">{print.description}</span>
              <span className="block space-y-0.5">
                {earned.slice(-3).map((r) => (
                  <span key={r.run} className="flex justify-between gap-1 text-[11px] tabular-nums">
                    <span className="text-ink">{multi ? ROMAN[r.run] ?? r.run : "Earned"}</span>
                    <span className="text-g4">{r.earned_at ? fmtDate(r.earned_at) : ""}</span>
                  </span>
                ))}
                {progress?.next_threshold != null && (
                  <span className="block text-[11px] tabular-nums text-g4">
                    {Math.max(0, Math.round((progress.next_threshold - progress.value) * 10) / 10)} {print.unit} to go
                  </span>
                )}
              </span>
            </span>
          </m.span>
        </button>
      </LazyMotion>
    </div>
  );
}
