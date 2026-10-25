"use client";

import type { MacroTotals, NutritionTargets } from "@/lib/types";
import { SectionCard } from "@/components/charts/section-card";
import { LimitBar } from "@/components/ui/limit-bar";
import { POSTER } from "@/lib/chart-theme";
import { useTracked } from "@/hooks/use-tracked";

interface Props {
  dailyAvg: MacroTotals;
  targets?: NutritionTargets | null;
}

/**
 * Average macros as a ruled row, like the Today poster: the figure in its plate ink with the
 * target beside it, and under it a bar on one absolute gram scale with a tick at the target.
 */
export function MacroAveragesCard({ dailyAvg, targets }: Props) {
  const { shows } = useTracked();
  const all = [
    { label: "Protein", key: "protein" as const, value: Math.round(dailyAvg.protein), target: targets?.target_protein_g ?? 150, ink: POSTER.protein, kind: "goal" as const },
    { label: "Carbs", key: "carbs" as const, value: Math.round(dailyAvg.carbs), target: targets?.target_carbs_g ?? 250, ink: POSTER.carbs, kind: "limit" as const },
    { label: "Fat", key: "fat" as const, value: Math.round(dailyAvg.fat), target: targets?.target_fat_g ?? 70, ink: POSTER.fat, kind: "limit" as const },
  ];
  const macros = all.filter((m) => shows(m.key));
  if (macros.length === 0) return null;
  // One scale for every bar, so grams compare honestly
  const scale = Math.max(...macros.flatMap((m) => [m.value, m.target * 1.15]));

  // The answer: what is off, protein when under 90% of its goal, a limit macro when past it
  const off = macros.flatMap((m) => (m.kind === "goal" ? (m.value < m.target * 0.9 ? [`${m.label.toLowerCase()} low`] : []) : m.value > m.target ? [`${m.label.toLowerCase()} over`] : []));
  const title = macros.every((m) => m.value === 0) ? "Macros" : `Macros: ${off.length ? off.join(", ") : "all on target"}`;

  return (
    <SectionCard title={title} summary="daily average">
      <div className="grid divide-x divide-g2" style={{ gridTemplateColumns: `repeat(${macros.length}, minmax(0, 1fr))` }}>
        {macros.map((m, i) => (
          <div key={m.key} className={i === 0 ? "pr-3" : "px-3"}>
            <p className="text-[12px] text-g4">{m.label}</p>
            <p className="mt-0.5 whitespace-nowrap">
              <span className="text-[22px] font-medium tabular-nums" style={{ color: m.ink }}>{m.value}</span>
              <span className="ml-0.5 text-[12px] text-g4">/{m.target} g</span>
            </p>
            <LimitBar className="mt-3" kind={m.kind} ink={m.ink} value={m.value} target={m.target} scale={scale} />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
