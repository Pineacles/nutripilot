"use client";

import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { endLabel } from "./end-label";
import { SectionCard, SectionEmpty } from "@/components/charts/section-card";
import { MultiLineTooltip } from "./chart-tooltip";
import { fmtDateAxis, useChartMotion, type DailyNutritionLike, AXIS_TICK_PROPS, fmtAxisTick, countDays, daysWord } from "@/lib/chart-utils";
import { useTracked } from "@/hooks/use-tracked";
import { POSTER, POSTER_CURSOR_LINE, POSTER_X_AXIS, POSTER_Y_AXIS, activeDotOf } from "@/lib/chart-theme";
import { TrendChart } from "./trend-chart";

interface Props {
  nutritionLength: number;
  rollingNutrition: (DailyNutritionLike & Record<string, number>)[];
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
}

const SERIES = [
  { key: "protein", name: "Protein", ink: POSTER.protein, mode: "goal" },
  { key: "carbs", name: "Carbs", ink: POSTER.carbs, mode: "limit" },
  { key: "fat", name: "Fat", ink: POSTER.fat, mode: "limit" },
] as const;

export function MacroTrendsCard({ nutritionLength, rollingNutrition, targetProtein, targetCarbs, targetFat }: Props) {
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

  let title = "Macros";
  if (one) {
    const t = targets[one.key];
    const values = logged.map((d) => Number(d[one.key]) || 0);
    if (values.length > 0) {
      title = one.mode === "goal"
        ? `${one.name}: hit ${t.toLocaleString("en-US")} g on ${countDays(values, (v) => v >= t).n} of ${values.length} days`
        : `${one.name}: over ${t.toLocaleString("en-US")} g on ${daysWord(countDays(values, (v) => v > t).n)}`;
    } else title = one.name;
  } else if (shows("protein") && logged.length > 0) {
    title = `Macros: protein hit on ${countDays(logged.map((d) => d.protein), (v) => v >= targetProtein).n} of ${logged.length} days`;
  }
  const last = rollingNutrition.length - 1;

  return (
    <SectionCard title={title} span="md:col-span-2" summary={one ? `grams, 7-day average, target ${targets[one.key]} g` : "grams, 7-day average"}>
      {nutritionLength === 0 ? (
        <SectionEmpty>No macros logged in this period.</SectionEmpty>
      ) : (
        <>
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
          {one ? (
            <TrendChart data={rollingNutrition} rawKey={one.key} avgKey={`avg_${one.key}`} plate={one.key} unit="g" target={targets[one.key]} mode={one.mode} height={220} />
          ) : (
            <>
              <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-g5">
                {shown.map((s) => (
                  <span key={s.key} className="flex items-center gap-1.5"><span className="h-0.5 w-3" style={{ background: s.ink }} />{s.name}</span>
                ))}
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
    </SectionCard>
  );
}
