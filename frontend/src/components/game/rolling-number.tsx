"use client";

import { useState } from "react";

/**
 * A figure whose changed digits roll up into place like an odometer, so a streak growing by one is
 * felt in the number. The first value renders still; reduced motion just shows the new value.
 */
export function RollingNumber({ value, className }: { value: number; className?: string }) {
  const text = String(Math.round(value));
  const [shown, setShown] = useState(text);
  const [before, setBefore] = useState<string | null>(null);
  if (shown !== text) {
    setBefore(shown);
    setShown(text);
  }
  // Align from the right so the ones digit compares with the ones digit.
  const pad = before !== null ? before.padStart(text.length, " ") : null;
  return (
    <span className={`inline-flex tabular-nums ${className ?? ""}`} aria-label={text}>
      {[...text].map((d, i) => (
        <span key={`${i}-${d}`} aria-hidden="true" className="relative inline-block overflow-hidden leading-none">
          <span className={`inline-block ${pad !== null && pad[i] !== d ? "animate-digit-up" : ""}`}>{d}</span>
        </span>
      ))}
    </span>
  );
}
