"use client";

import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { endLabel } from "./end-label";
import { MultiLineTooltip } from "./chart-tooltip";
import { MacroSplit } from "./macro-distribution-card";
import { ScoreRow, Sparkline } from "./scorecard-row";
import { TrendChart } from "./trend-chart";
import { summarize, type RowStatus } from "./metrics";
import { fmtDateAxis, useChartMotion, type DailyNutritionLike, AXIS_TICK_PROPS, fmtAxisTick } from "@/lib/chart-utils";
import { useTracked } from "@/hooks/use-tracked";
import { POSTER, POSTER_CURSOR_LINE, POSTER_X_AXIS, POSTER_Y_AXIS, activeDotOf } from "@/lib/chart-theme";
import type { MacroTotals } from "@/lib/types";

interface Props {
  nutritionLength: number;
  rollingNutrition: (DailyNutritionLike & Record<string, number>)[];
  macroAvg: MacroTotals | undefined;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  open: boolean;
  onToggle: () => void;
}

const SERIES = [
  { key: "protein", name: "Protein", ink: POSTER.protein, mode: "goal" },
  { key: "carbs", name: "Carbs", ink: POSTER.carbs, mode: "limit" },
  { key: "fat", name: "Fat", ink: POSTER.fat, mode: "limit" },
] as const;

/**
 * The Macros row: the answer is protein (a goal) and carbs or fat over target; the detail is the
 * split strip, then the 7-day trends of every visible macro together or one at a time.
 */
export function MacroRow({ nutritionLength, rollingNutrition, macroAvg, targetProtein, targetCarbs, targetFat, open, onToggle }: Props) {
  const [macroTab, setMacroTab] = useState<"protein" | "carbs" | "fat" | "all">("all");
  const { shows } = useTracked();
  const motion = useChartMotion();
  const macros = (["protein", "carbs", "fat"] as const).filter((t) => shows(t));
  if (macros.length === 0) return null;
  // With one macro visible there is nothing to switch between: just its chart, no chips.
  const tabs: readonly ("all" | "protein" | "carbs" | "fat")[] = macros.length === 1 ? macros : ["all", ...macros];
  // A tab hidden after it was picked falls back to all series (or the one macro left).
  const activeTab = macros.length === 1 ? macros[0] : tabs.includes(macroTab) ? macroTab : "all";
  const targets = { protein: targetProtein, carbs: targetCarbs, fat: targetFat };
  const shown = SERIES.filter((s) => shows(s.key));
  const one = activeTab === "all" ? null : SERIES.find((s) => s.key === activeTab)!;
  const logged = rollingNutrition.filter((d) => d.kcal > 0);
  const last = rollingNutrition.length - 1;

  const sums = shown.map((s) => ({ s, sum: summarize(logged.map((d) => Number(d[s.key]) || 0), targets[s.key], s.mode, "g", "target") }));
  const lead = sums[0];
  const alerting = sums.find((x) => x.sum.status === "low" || x.sum.status === "over");
  const status: RowStatus = nutritionLength === 0 ? "none" : alerting ? alerting.sum.status : "ok";
  const answer = nutritionLength === 0 ? "Nothing logged in this period" : `${lead.s.name} ${lead.sum.answer}`;
  const oneSum = one ? sums.find((x) => x.s.key === one.key)!.sum : null;

  return (
    <ScoreRow
      name="Macros"
      swatches={shown.map((s) => s.ink)}
      answer={answer}
      status={status}
      spark={nutritionLength > 0 ? <Sparkline series={shown.map((s) => ({ values: rollingNutrition.map((d) => Number(d[`avg_${s.key}`]) || 0), ink: s.ink }))} /> : undefined}
      open={open}
      onToggle={onToggle}
    >
      {nutritionLength === 0 ? (
        <p className="py-3 text-[13px] text-g4">No macros logged in this period.</p>
      ) : (
        <>
          <MacroSplit macroAvg={macroAvg} />
          {macros.length > 1 && (
            <div role="group" aria-label="Macro" className="mb-4 flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  aria-pressed={activeTab === tab}
                  onClick={() => setMacroTab(tab)}
                  className={`h-10 rounded-full border px-4 text-[13px] font-medium transition-colors duration-150 ${
                    activeTab === tab ? "border-ink bg-ink text-g0" : "border-g3 text-g5 hover:border-g5 hover:text-ink"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          )}
          {one && oneSum ? (
            <>
              <p className="mb-3 text-[13px] tabular-nums text-g4">{one.name} {oneSum.answer}, 7-day average, target {targets[one.key]} g</p>
              <TrendChart data={rollingNutrition} rawKey={one.key} avgKey={`avg_${one.key}`} plate={one.key} unit="g" target={targets[one.key]} mode={one.mode} height={220} />
            </>
          ) : (
            <>
              <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-g5">
                {shown.map((s) => (
                  <span key={s.key} className="flex items-center gap-1.5"><span className="h-0.5 w-3" style={{ background: s.ink }} />{s.name}</span>
                ))}
                <span className="text-g4">grams, 7-day average</span>
              </p>
              <ResponsiveContainer minWidth={0} width="100%" height={220}>
                <LineChart data={rollingNutrition} margin={{ top: 8, right: 52, bottom: 0, left: 0 }}>
                  <XAxis dataKey="date" {...POSTER_X_AXIS} {...AXIS_TICK_PROPS} tickFormatter={(v: string) => fmtDateAxis(v, rollingNutrition.length)} />
                  <YAxis {...POSTER_Y_AXIS} width={40} tickFormatter={fmtAxisTick} />
                  <Tooltip content={<MultiLineTooltip />} cursor={POSTER_CURSOR_LINE} />
                  {shown.map((s) => (
                    <Line key={s.key} type="monotone" dataKey={`avg_${s.key}`} name={`${s.name} (g)`} stroke={s.ink} strokeWidth={2} dot={false} activeDot={activeDotOf(s.ink)} label={endLabel(s.name, s.ink, last)} {...motion} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </>
      )}
    </ScoreRow>
  );
}
