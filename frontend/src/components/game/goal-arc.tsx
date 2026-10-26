"use client";

import { useEffect, useState } from "react";

/**
 * A day goal as a small quarter arc, the same shape as the poster's corner: it fills toward the goal
 * in the goal's plate and, once done, a Done Green check draws beside it.
 */
export function GoalArc({ fraction, ink, size = 28 }: { fraction: number; ink: string; size?: number }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const S = 40;
  const r = 30;
  const d = `M${S} ${S - r} A${r} ${r} 0 0 0 ${S - r} ${S}`;
  return (
    <svg viewBox={`0 0 ${S} ${S}`} width={size} height={size} fill="none" aria-hidden="true" className="shrink-0">
      <path d={d} stroke="var(--g2)" strokeWidth={8} />
      <path
        d={d}
        pathLength={1}
        stroke={ink}
        strokeWidth={8}
        strokeDasharray={`${drawn ? Math.max(0, Math.min(1, fraction)) : 0} 2`}
        className="transition-[stroke-dasharray] duration-(--dur-draw) ease-(--ease-out) motion-reduce:transition-none"
      />
    </svg>
  );
}

/** The check that draws itself when a goal or quest is done, in Done Green. */
export function DoneCheck({ animate, size = 16 }: { animate: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M3 8.5 6.5 12 13 4.5"
        pathLength={1}
        stroke="var(--done)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={animate ? "animate-check" : ""}
      />
    </svg>
  );
}
