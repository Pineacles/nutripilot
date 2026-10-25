"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/**
 * A number that eases to its new value when it changes, so a log is felt in the figure itself.
 * Starts at the first value (no count-up on page load) and jumps under reduced motion. Pass
 * `ready = false` while the data is still loading, so the first real value is not rolled up from 0.
 */
export function useCountUp(value: number, ms = 600, ready = true): number {
  const reduced = useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => true);
  // The in-between value while rolling; null when settled, so the real value always wins.
  const [rolling, setRolling] = useState<number | null>(null);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (reduced || !ready || start === value) {
      from.current = value;
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const v = start + (value - start) * (1 - Math.pow(1 - p, 4));
      from.current = v;
      setRolling(p < 1 ? v : null);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      setRolling(null);
    };
  }, [value, ms, reduced, ready]);
  return reduced || !ready || rolling === null ? value : rolling;
}
