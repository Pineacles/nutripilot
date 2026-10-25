"use client";

import { fmt } from "@/lib/utils";
import { useCountUp } from "@/hooks/use-count-up";

interface Props {
  currentWeight: number | null;
  weightChange: number | null;
  /** Length of the chosen period, for the sentence under the weight. */
  days: number;
  weeklyAvgChange: number | null;
}

export const signed = (v: number | null, decimals = 1) =>
  v == null ? "--" : `${v > 0 ? "+" : v < 0 ? "-" : ""}${fmt(Math.abs(v), decimals)}`;

function periodWords(days: number) {
  return days === 365 ? "1 year" : `${days} days`;
}

/** The answer to the page's one question: what do I weigh now, and how has it moved. */
export function HeroStats({ currentWeight, weightChange, days, weeklyAvgChange }: Props) {
  const shown = useCountUp(currentWeight ?? 0, 600, currentWeight != null);
  const trend =
    weightChange == null
      ? null
      : weightChange === 0
        ? `No change in ${periodWords(days)}`
        : `${signed(weightChange)} kg in ${periodWords(days)}${weeklyAvgChange != null ? `, ${signed(weeklyAvgChange, 2)} kg a week` : ""}`;

  return (
    <div className="border-b border-g2 pb-5 pt-4 tabular-nums">
      <p className="text-[12px] text-g4">Weight</p>
      <p className="mt-3 flex items-baseline gap-2 text-ink">
        <span className="text-[6.5rem] font-bold leading-[0.8] tracking-[-0.045em] sm:text-[7.5rem]">
          {currentWeight != null ? fmt(shown) : "--"}
        </span>
        {currentWeight != null && <span className="text-[22px] font-medium text-g4">kg</span>}
      </p>
      <p className="mt-4 text-[15px] text-ink">
        {trend ?? (currentWeight == null ? "No weight logged in this period" : "")}
      </p>
    </div>
  );
}
