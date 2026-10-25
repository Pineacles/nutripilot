"use client";

import { useMemo } from "react";
import { SectionCard, SectionEmpty } from "@/components/charts/section-card";
import { POSTER } from "@/lib/chart-theme";
import type { MacroTotals } from "@/lib/types";
import { useTracked } from "@/hooks/use-tracked";

interface Props {
  macroAvg: MacroTotals | undefined;
}

/**
 * Share of the day's macro grams: one square strip split in the three plate inks, and under it a
 * ruled row with each macro's share in its own plate. No donut, no legend.
 */
export function MacroDistributionCard({ macroAvg }: Props) {
  const { hidden } = useTracked();
  const macroPie = useMemo(() => {
    if (!macroAvg) return [];
    const shown = (key: string) => !hidden.has(key);
    const total = (shown("protein") ? macroAvg.protein : 0) + (shown("carbs") ? macroAvg.carbs : 0) + (shown("fat") ? macroAvg.fat : 0);
    if (total === 0) return [];
    return [
      { key: "protein", name: "Protein", share: (macroAvg.protein / total) * 100, value: Math.round((macroAvg.protein / total) * 100), grams: Math.round(macroAvg.protein), ink: POSTER.protein },
      { key: "carbs", name: "Carbs", share: (macroAvg.carbs / total) * 100, value: Math.round((macroAvg.carbs / total) * 100), grams: Math.round(macroAvg.carbs), ink: POSTER.carbs },
      { key: "fat", name: "Fat", share: (macroAvg.fat / total) * 100, value: Math.round((macroAvg.fat / total) * 100), grams: Math.round(macroAvg.fat), ink: POSTER.fat },
    ].filter((m) => shown(m.key));
  }, [macroAvg, hidden]);

  const top = [...macroPie].sort((a, b) => b.share - a.share)[0];

  // One macro is always 100%, which says nothing: the split needs at least two.
  if (["protein", "carbs", "fat"].filter((k) => !hidden.has(k)).length < 2) return null;

  return (
    <SectionCard title={top ? `Macro split: mostly ${top.name.toLowerCase()} (${top.value}%)` : "Macro split"} span="md:col-span-2" summary="share of grams">
      {macroPie.length === 0 ? (
        <SectionEmpty>No macros logged in this period.</SectionEmpty>
      ) : (
        <>
          <div className="flex h-3 gap-px" role="img" aria-label={macroPie.map((m) => `${m.name} ${m.value}%`).join(", ")}>
            {macroPie.map((m) => (
              <div key={m.key} className="animate-bar h-full" style={{ width: `${m.share}%`, background: m.ink }} />
            ))}
          </div>
          <dl className="mt-4 grid divide-x divide-g2" style={{ gridTemplateColumns: `repeat(${macroPie.length}, minmax(0, 1fr))` }}>
            {macroPie.map((m, i) => (
              <div key={m.key} className={i === 0 ? "pr-3" : "px-3"}>
                <dt className="text-[12px] text-g4">{m.name}</dt>
                <dd className="mt-0.5 whitespace-nowrap">
                  <span className="text-[22px] font-medium tabular-nums" style={{ color: m.ink }}>{m.value}</span>
                  <span className="text-[12px] text-g4">% </span>
                  <span className="text-[12px] tabular-nums text-g4">{m.grams} g</span>
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </SectionCard>
  );
}
