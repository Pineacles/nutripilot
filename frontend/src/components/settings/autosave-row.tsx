"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type Parsed<T> = { value: T } | { error: string };

interface Props<T> {
  id: string;
  /** The row's name, left. */
  label: React.ReactNode;
  /** Plate ink of a 10px swatch before the name. */
  swatch?: string;
  /** The value the server holds. */
  value: T;
  toText: (v: T) => string;
  parse: (text: string) => Parsed<T>;
  /** Stores the new value; rejects when the save fails. */
  onSave: (v: T) => Promise<unknown>;
  unit?: string;
  /** Dimmed and not editable; the value is kept. */
  disabled?: boolean;
  /** Right of the field (a nutrient's on/off switch). */
  trail?: React.ReactNode;
  type?: "number" | "text";
  list?: string;
  placeholder?: string;
  fieldClass?: string;
}

/**
 * A hairline row of at least 60px with one field that saves by itself: when it loses focus, is
 * valid and has changed. A check ticks beside the field for 1.5s, a failure shows a line under the
 * row with a retry. There is no Save button.
 */
export function AutosaveRow<T>({
  id, label, swatch, value, toText, parse, onSave, unit, disabled, trail, type = "number", list, placeholder, fieldClass,
}: Props<T>) {
  const [draft, setDraft] = useState<string | null>(null);
  // The value just stored, shown until the refetch brings it back as `value`.
  const [confirmed, setConfirmed] = useState<{ from: T; to: T } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [ticked, setTicked] = useState(0);
  const [tickOn, setTickOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const current = confirmed && Object.is(confirmed.from, value) ? confirmed.to : value;
  const shown = draft ?? toText(current);

  async function commit(text: string) {
    const parsed = parse(text);
    if ("error" in parsed) {
      setError(parsed.error);
      setFailed(false);
      return;
    }
    setError(null);
    setFailed(false);
    if (Object.is(parsed.value, current)) {
      setDraft(null);
      return;
    }
    try {
      await onSave(parsed.value);
      setConfirmed({ from: value, to: parsed.value });
      setDraft(null);
      setTicked((n) => n + 1);
      setTickOn(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setTickOn(false), 1500);
    } catch {
      setError("Couldn't save.");
      setFailed(true);
    }
  }

  return (
    <div className="relative border-t border-g2">
      {ticked > 0 && <div key={ticked} aria-hidden="true" className="animate-lit pointer-events-none absolute inset-0" />}
      <div className="relative flex min-h-[60px] items-center gap-3">
        <label htmlFor={id} className={cn("flex min-w-0 flex-1 items-center gap-2.5 text-[15px]", disabled ? "text-g4" : "text-ink")}>
          {swatch && <span aria-hidden="true" className="inline-block size-[10px] shrink-0" style={{ background: swatch }} />}
          <span className="truncate">{label}</span>
        </label>
        <div className={cn("relative flex shrink-0 items-center gap-2", disabled && "opacity-40")}>
          <span
            aria-hidden="true"
            className={cn("absolute right-full mr-1.5 text-ink transition-opacity duration-[var(--dur)] motion-reduce:transition-none", tickOn ? "opacity-100" : "opacity-0")}
          >
            <Check className="h-4 w-4" strokeWidth={2} />
          </span>
          <Input
            id={id}
            type={type}
            inputMode={type === "number" ? "decimal" : undefined}
            list={list}
            value={shown}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
              setFailed(false);
            }}
            onBlur={() => { if (draft !== null) void commit(draft); }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            className={cn(type === "number" ? "w-24 text-right tabular-nums" : "w-52", fieldClass)}
          />
          {unit !== undefined && <span className="w-8 text-xs text-g4">{unit}</span>}
        </div>
        {trail}
      </div>
      <span className="sr-only" role="status">{tickOn ? "Saved" : ""}</span>
      {error && (
        <p id={`${id}-error`} className="-mt-1 flex items-center gap-2 pb-3 text-xs text-ink">
          {error}
          {failed && (
            <button type="button" onClick={() => void commit(draft ?? toText(current))} className="inline-flex h-11 items-center px-2 text-xs font-medium underline underline-offset-2">
              Retry
            </button>
          )}
        </p>
      )}
    </div>
  );
}

/** Parse for a number field, optionally empty (null), within bounds. */
export function numberParser(bounds: { min: number; max: number }, optional: true): (t: string) => Parsed<number | null>;
export function numberParser(bounds: { min: number; max: number }, optional?: false): (t: string) => Parsed<number>;
export function numberParser(bounds: { min: number; max: number }, optional = false) {
  return (text: string): Parsed<number | null> => {
    const t = text.trim().replace(",", ".");
    if (t === "") return optional ? { value: null } : { error: "Enter a number" };
    const n = Number(t);
    if (Number.isNaN(n)) return { error: "Enter a number" };
    if (n < bounds.min) return { error: `Must be at least ${bounds.min}` };
    if (n > bounds.max) return { error: `Must be at most ${bounds.max}` };
    return { value: n };
  };
}
