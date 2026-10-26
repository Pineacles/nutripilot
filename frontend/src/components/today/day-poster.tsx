"use client";

import { toast } from "sonner";
import { useTracked } from "@/hooks/use-tracked";
import { useLogWater } from "@/hooks/mutations/water";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useCountUp } from "@/hooks/use-count-up";
import { LimitBar } from "@/components/ui/limit-bar";
import { ALERT, plateOf } from "@/lib/plates";
import { NutrientSourcesDialog, type SourcesTarget } from "./nutrient-sources-dialog";
import type { CaffeineTotals, MacroTargets, MacroTotals, WaterTotals } from "@/lib/types";

type BarSpec = { value: number; target: number; kind: "limit" | "goal" };

/** A cell's plate ink for its value and bar (undefined = ink and g5), and the overflow said in words. */
type CellStyle = { ink?: string; extra?: string };

interface Props {
  /** The day shown, for water logged from the poster. */
  date: string;
  totals: MacroTotals;
  targets: MacroTargets;
  water?: WaterTotals | null;
  caffeine?: CaffeineTotals | null;
  /** Set in the hero's top left corner, above the kcal figure: the streak on today. */
  heroSlot?: React.ReactNode;
  /** The calorie window's floor when motivation is on: the kcal line then says when the day is in it. */
  windowFloor?: number | null;
}

const MACROS = [
  { key: "protein", label: "Protein", ink: "var(--protein)" },
  { key: "carbs", label: "Carbs", ink: "var(--carbs)" },
  { key: "fat", label: "Fat", ink: "var(--fat)" },
] as const;

// Static class maps so Tailwind sees every name.
const PHONE_COLS = ["", "grid-cols-1", "grid-cols-2", "grid-cols-3"];
const WIDE_COLS = ["", "sm:grid-cols-1", "sm:grid-cols-2", "sm:grid-cols-3", "sm:grid-cols-4", "sm:grid-cols-5", "sm:grid-cols-6"];
const PHONE_SPAN = ["", "", "col-span-2", "col-span-3"];
const WIDE_SPAN = ["", "", "sm:col-span-2", "sm:col-span-3", "sm:col-span-4", "sm:col-span-5", "sm:col-span-6"];

/**
 * Padding and span of cell i in the flowing grid. The rules are 1px gaps over a g2 ground, so only
 * internal rules exist; a short last row has its last cell stretch so no hole is left. A cell in the
 * left column has no left padding, so its text aligns with the page edge.
 */
function cellClass(i: number, count: number, cols: number, wideCols: number): string {
  const lastRow = count - (count % cols || cols);
  const wideLastRow = count - (count % wideCols || wideCols);
  const span = i === count - 1 && i >= lastRow ? PHONE_SPAN[cols - (i - lastRow)] : "";
  const wideSpan = (i === count - 1 && i >= wideLastRow ? WIDE_SPAN[wideCols - (i - wideLastRow)] : "") || (span ? "sm:col-span-1" : "");
  const left = i % cols === 0 ? "pl-0" : "pl-2 min-[400px]:pl-3";
  const wideLeft = i % wideCols === 0 ? "sm:pl-0" : "sm:pl-3";
  return `${left} ${wideLeft} pr-2 min-[400px]:pr-3 ${span} ${wideSpan}`;
}

/** Quarter arc around the box's bottom right corner, from 12 o'clock towards 9 o'clock. */
function arc(r: number, fraction: number, size: number): string {
  const f = Math.max(0, Math.min(1, fraction));
  const a = (-90 - 90 * f) * (Math.PI / 180);
  const x = size + r * Math.cos(a);
  const y = size + r * Math.sin(a);
  return `M${size} ${size - r} A${r} ${r} 0 0 0 ${x.toFixed(1)} ${y.toFixed(1)}`;
}

/** A number that rolls to its new value after a log; the first value is shown as is. */
function Roll({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const shown = useCountUp(value);
  return <>{decimals > 0 ? shown.toFixed(decimals) : Math.round(shown)}</>;
}

/**
 * The day as one poster: what has been eaten set huge, the macros as concentric arcs bleeding off the
 * corner, then the macros on one gram scale (so days compare honestly) and the drinks.
 */
export function DayPoster({ date, totals, targets, water, caffeine, heroSlot, windowFloor }: Props) {
  const { shows } = useTracked();
  const logWater = useLogWater();
  const [sources, setSources] = useState<SourcesTarget | null>(null);
  const eaten = Math.round(totals.kcal);
  const left = Math.round(targets.kcal - totals.kcal);
  const over = left < 0;
  const figure = String(eaten);
  // The arcs draw in once on first paint: they start empty and ease to the day's values.
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const macros = MACROS.filter((m) => shows(m.key));
  const arcs = [
    { key: "kcal", value: totals.kcal, target: targets.kcal, ink: "var(--ink)" },
    ...macros.map((m) => ({ key: m.key, value: totals[m.key], target: targets[m.key], ink: m.ink })),
  ];
  // One scale for every macro bar: the largest target or amount of the day.
  const scale = Math.max(1, ...macros.flatMap((m) => [targets[m.key], totals[m.key]]));

  const drinks = ([
    shows("caffeine") && caffeine
      ? { label: "Caffeine", ink: plateOf("caffeine"), extra: `+${Math.round(caffeine.total_mg - caffeine.target_mg)} mg`, text: `${Math.round(caffeine.total_mg)} / ${Math.round(caffeine.target_mg)} mg`, over: caffeine.total_mg > caffeine.target_mg, bar: { value: caffeine.total_mg, target: caffeine.target_mg, kind: "limit" as const } }
      : null,
    shows("alcohol") && targets.alcohol > 0
      ? { label: "Alcohol", ink: plateOf("alcohol"), extra: `+${Math.round(totals.alcohol - targets.alcohol)} g`, text: `${Math.round(totals.alcohol)} / ${Math.round(targets.alcohol)} g`, over: totals.alcohol > targets.alcohol, bar: { value: totals.alcohol, target: targets.alcohol, kind: "limit" as const } }
      : null,
  ] as (({ label: string; text: string; over: boolean; bar: BarSpec } & CellStyle) | null)[]).filter((d) => d !== null);

  // Fiber is a goal to reach; sugar and salt are limits. Over a limit says "over" and the overflow in --alert.
  const details = ([
    shows("fiber") ? { key: "fiber", unit: "g", label: "Fiber", ink: plateOf("fiber"), text: `${Math.round(totals.fiber)} / ${Math.round(targets.fiber)} g`, over: false, bar: { value: totals.fiber, target: targets.fiber, kind: "goal" as const } } : null,
    shows("sugar") ? { key: "sugar", unit: "g", label: "Sugar", extra: `+${Math.round(totals.sugar - targets.sugar)} g`, text: `${Math.round(totals.sugar)} / ${Math.round(targets.sugar)} g`, over: totals.sugar > targets.sugar, bar: { value: totals.sugar, target: targets.sugar, kind: "limit" as const } } : null,
    shows("salt") ? { key: "sodium", unit: "mg sodium", label: "Salt", extra: `+${((totals.sodium - targets.sodium) * 2.5 / 1000).toFixed(1)} g`, text: `${(totals.sodium * 2.5 / 1000).toFixed(1)} / ${(targets.sodium * 2.5 / 1000).toFixed(1)} g`, over: totals.sodium > targets.sodium, bar: { value: totals.sodium, target: targets.sodium, kind: "limit" as const } } : null,
  ] as (({ key: string; unit: string; label: string; text: string; over: boolean; bar: BarSpec } & CellStyle) | null)[]).filter((d) => d !== null);

  const SIZE = 200;
  // Fewer arcs get thicker strokes so the corner never holds one thin lonely line; the outer edge stays put.
  const STROKE = [30, 20, 13, 13][arcs.length - 1] ?? 13;
  const GAP = 13;
  // Every detail and drink cell in one flowing grid, so partial hiding never leaves a band with one cell.
  const waterCell = shows("water") && water;
  const cellCount = details.length + drinks.length + (waterCell ? 1 : 0);
  const cols = cellCount <= 3 ? cellCount : cellCount === 4 ? 2 : 3;
  const wideCols = Math.min(cellCount, cellCount === 7 ? 4 : 6);
  return (
    <section aria-label="Today at a glance" className="relative md:col-span-2 lg:col-span-3">
      <div className="relative h-[172px] overflow-hidden border-b border-g2 min-[400px]:h-[196px] sm:h-[260px]">
        <svg
          className="absolute -top-1 -right-4 h-[124px] w-[124px] min-[400px]:h-[140px] min-[400px]:w-[140px] sm:h-[200px] sm:w-[200px] lg:right-0"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          fill="none"
          aria-hidden="true"
        >
          {arcs.map((a, i) => {
            const r = SIZE - 5.5 - STROKE / 2 - i * (STROKE + GAP);
            return (
              <g key={a.key}>
                <path d={arc(r, 1, SIZE)} stroke="var(--g2)" strokeWidth={STROKE} />
                {/* Dash length on a unit path: draws in once, then eases to every new value */}
                <path
                  d={arc(r, 1, SIZE)}
                  pathLength={1}
                  stroke={a.ink}
                  strokeWidth={STROKE}
                  strokeDasharray={`${drawn && a.target > 0 ? Math.min(1, a.value / a.target) : 0} 2`}
                  className="transition-[stroke-dasharray] duration-(--dur-draw) ease-(--ease-out) motion-reduce:transition-none"
                />
                {/* Past the target a quarter arc has no room to show it: a small alert cap marks the end of the full arc */}
                {a.key === "kcal" && over && drawn && (
                  <path d={`M${SIZE - r - STROKE / 2} ${SIZE} H${SIZE - r + STROKE / 2}`} stroke={ALERT} strokeWidth={3} />
                )}
              </g>
            );
          })}
        </svg>
        {heroSlot && <div className="absolute top-3 left-0 z-10 max-w-[calc(100%-8.5rem)] sm:max-w-[calc(100%-14rem)]">{heroSlot}</div>}
        {/* Sized by digit count, so a long number never runs into the arcs */}
        <p
          className={`absolute bottom-7 left-0 leading-[0.8] font-bold tracking-[-0.045em] tabular-nums ${
            figure.length <= 3 ? "text-[6.5rem] min-[400px]:text-[7.5rem] sm:text-[8.5rem]" : figure.length === 4 ? "text-[5.5rem] min-[400px]:text-[6.25rem] sm:text-[8rem]" : "text-[4rem] min-[400px]:text-[4.5rem] sm:text-[7.5rem]"
          } text-ink`}
        >
          <Roll value={eaten} />
        </p>
        <p className="absolute bottom-1.5 left-0.5 text-[13px] text-g5">
          {over ? (
            <>
              <span className="text-ink">kcal eaten</span>, <span className="font-semibold text-alert">{Math.abs(left)} over</span> {Math.round(targets.kcal)}
            </>
          ) : (
            <>
              <span className="text-ink">kcal eaten</span> of {Math.round(targets.kcal)}, {left} left
              {windowFloor != null && eaten >= windowFloor && <span className="text-ink">, in your window</span>}
            </>
          )}
        </p>
      </div>

      {macros.length > 0 && (
        <div className="grid divide-x divide-g2 border-b border-g2" style={{ gridTemplateColumns: `repeat(${macros.length}, minmax(0, 1fr))` }}>
          {macros.map((m, i) => {
            const value = Math.round(totals[m.key]);
            const target = Math.round(targets[m.key]);
            const gap = target - value;
            // Over a fat or carbs target is attention; over a protein target is just more protein.
            const overAlert = gap < 0 && m.key !== "protein";
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setSources({ key: m.key, label: m.label, unit: "g", ink: m.ink })}
                aria-label={`${m.label} ${value} of ${target} g, show where it came from`}
                className={`py-3.5 text-left transition-colors hover:bg-g1 ${macros.length === 1 ? "" : i === 0 ? "pr-3" : "px-3"}`}
              >
                {/* A lone macro spans the row: what is left sits opposite the value instead of leaving a hole */}
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] text-g4">{m.label}</p>
                    <p className="mt-1 whitespace-nowrap tabular-nums">
                      <span className="text-[22px] font-medium" style={{ color: m.ink }}><Roll value={value} /></span>
                      <span className="ml-0.5 text-[12px] text-g4">/{target} g</span>
                    </p>
                  </div>
                  {macros.length === 1 && (
                    <p className="whitespace-nowrap text-[13px] tabular-nums text-g5">
                      {gap >= 0 ? `${gap} g left` : <span className={`font-semibold ${overAlert ? "text-alert" : "text-ink"}`}>+{-gap} g over</span>}
                    </p>
                  )}
                </div>
                <div className="relative mt-2.5 h-[3px] bg-g2" aria-hidden="true">
                  <div className="animate-bar absolute inset-y-0 left-0 transition-[width] duration-500 ease-(--ease-out) motion-reduce:transition-none" style={{ width: `${Math.min(100, (Math.min(value, target) / scale) * 100)}%`, background: m.ink }} />
                  {gap < 0 && (
                    <div
                      className="animate-bar absolute inset-y-0 transition-[left,width] duration-500 ease-(--ease-out) motion-reduce:transition-none"
                      style={{ left: `${Math.min(100, (target / scale) * 100)}%`, width: `${Math.min(100, (value / scale) * 100) - Math.min(100, (target / scale) * 100)}%`, background: overAlert ? ALERT : m.ink }}
                    />
                  )}
                  <div className="absolute -top-1 h-[11px] w-px bg-g5" style={{ left: `${Math.min(100, (target / scale) * 100)}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {cellCount > 0 && (
        <dl className={`grid gap-px border-b border-g2 bg-g2 ${PHONE_COLS[cols]} ${WIDE_COLS[wideCols]}`}>
          {details.map((d, i) => (
            <Cell key={d.label} className={cellClass(i, cellCount, cols, wideCols)} label={d.label} text={d.text} over={d.over} extra={d.extra} ink={d.ink} bar={d.bar} onOpen={() => setSources({ key: d.key, label: d.label === "Salt" ? "Sodium" : d.label, unit: d.unit === "g" ? "g" : "mg", ink: d.ink })} />
          ))}
          {/* Water is logged right here, a tap on + adds a glass (250 ml) */}
          {waterCell && (
            <div className={`flex items-center gap-1 bg-g0 py-2 ${cellClass(details.length, cellCount, cols, wideCols)}`}>
              <div className="min-w-0 flex-1">
                <dt className="text-[12px] text-g4">Water</dt>
                <dd className="mt-0.5 whitespace-nowrap text-[14px] tabular-nums min-[400px]:text-[15px]" style={{ color: plateOf("water") }}>
                  <Roll value={water.total_ml / 1000} decimals={1} />/{(water.target_ml / 1000).toFixed(1)} l
                </dd>
                <LimitBar value={water.total_ml} target={water.target_ml} kind="goal" ink={plateOf("water")} className="mt-2" />
              </div>
              <button
                type="button"
                disabled={logWater.isPending}
                onClick={() => logWater.mutate({ amount_ml: 250, date }, { onSuccess: () => toast.success("+250 ml water") })}
                aria-label="Add 250 ml water"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-g3 text-ink transition-[color,border-color,transform] duration-(--dur-fast) ease-(--ease-out) hover:border-water hover:text-water active:border-water active:text-water active:scale-90 disabled:opacity-50 motion-reduce:transition-none"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
          {drinks.map((d, i) => <Cell key={d.label} className={cellClass(i + details.length + (waterCell ? 1 : 0), cellCount, cols, wideCols)} {...d} />)}
        </dl>
      )}
      <NutrientSourcesDialog target={sources} date={date} onClose={() => setSources(null)} />
    </section>
  );
}

/** One value in a ruled row; over a limit it says "over" beside the label and the overflow after the value, in --alert. */
function Cell({ label, text, over, extra, ink, className, bar, onOpen }: { label: string; text: string; over: boolean; extra?: string; ink?: string; className: string; bar?: BarSpec; onOpen?: () => void }) {
  const body = (
    <>
      <dt className="text-[12px] text-g4">
        {label}
        {over && <span className="ml-1.5 font-medium text-alert">over</span>}
      </dt>
      <dd className={`mt-0.5 whitespace-nowrap text-[14px] tabular-nums min-[400px]:text-[15px] ${ink ? "" : "text-ink"} ${over ? "font-semibold" : ""}`} style={ink ? { color: ink } : undefined}>
        {text}
        {over && extra && <span className="ml-1 text-alert">{extra}</span>}
      </dd>
      {bar && <LimitBar value={bar.value} target={bar.target} kind={bar.kind} ink={ink} className="mt-2" />}
    </>
  );
  const cls = `min-w-0 bg-g0 py-3 text-left ${className}`;
  return onOpen ? (
    <button type="button" onClick={onOpen} className={`${cls} transition-colors hover:bg-g1`}>{body}</button>
  ) : (
    <div className={cls}>{body}</div>
  );
}
