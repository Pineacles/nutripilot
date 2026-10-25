"use client";

import { fmt } from "@/lib/utils";
import { useCountUp } from "@/hooks/use-count-up";

interface Props {
  currentWeight: number | null;
  weightChange: number | null;
  /** Length of the chosen period, for the sentence beside the weight. */
  days: number;
  currentBf: number | null;
  currentFatKg: number | null;
  fatKgChange: number | null;
  currentMuscle: number | null;
  currentMuscleKg: number | null;
  muscleKgChange: number | null;
  bmi: number | null;
  weeklyAvgChange: number | null;
  /** Goal weight, to tell whether the weekly rate moves toward it or away. */
  targetWeight?: number | null;
}

const signed = (v: number | null, decimals = 1) =>
  v == null ? "--" : `${v > 0 ? "+" : v < 0 ? "-" : ""}${fmt(Math.abs(v), decimals)}`;

function periodWords(days: number) {
  return days === 365 ? "1 year" : `${days} days`;
}

function Cell({ label, value, unit, note }: { label: string; value: string; unit?: string; note?: string | null }) {
  return (
    <div className="min-w-0 px-3 py-3 first:pl-0">
      <p className="text-[12px] text-g4">{label}</p>
      <p className="mt-0.5 text-[22px] font-medium leading-tight text-ink">
        {value}
        {unit && value !== "--" && <span className="ml-0.5 text-[12px] font-normal text-g4">{unit}</span>}
      </p>
      {note && <p className="mt-0.5 text-[12px] text-g4">{note}</p>}
    </div>
  );
}

/**
 * The answer to the page's one question: what do I weigh now. The weight is the display figure,
 * the change over the period is said in words beside it, and the composition sits in ruled cells.
 */
export function HeroStats({
  currentWeight, weightChange, days, currentBf, currentFatKg, fatKgChange,
  currentMuscle, currentMuscleKg, muscleKgChange, bmi, weeklyAvgChange, targetWeight = null,
}: Props) {
  const shown = useCountUp(currentWeight ?? 0, 600, currentWeight != null);
  const trend =
    weightChange == null
      ? null
      : weightChange === 0
        ? `No change in ${periodWords(days)}`
        : `${signed(weightChange)} kg in ${periodWords(days)}`;

  // Away from the goal is said in a word with --alert, and only when it is notable (> 0.5 kg/week).
  const awayFromGoal =
    currentWeight != null && targetWeight != null && weeklyAvgChange != null &&
    (currentWeight > targetWeight ? weeklyAvgChange > 0.5 : currentWeight < targetWeight && weeklyAvgChange < -0.5);

  return (
    <div className="tabular-nums">
      <div className="border-b border-g2 pb-6 pt-4">
        <p className="text-[12px] text-g4">Weight</p>
        <p className="mt-3 flex items-baseline gap-2 text-ink">
          <span className="text-[6.5rem] font-bold leading-[0.8] tracking-[-0.045em] sm:text-[7.5rem]">
            {currentWeight != null ? fmt(shown) : "--"}
          </span>
          {currentWeight != null && <span className="text-[22px] font-medium text-g4">kg</span>}
        </p>
        <p className="mt-5 text-[15px] text-ink">
          {trend ?? (currentWeight == null ? "No weight logged in this period" : "")}
        </p>
        {weeklyAvgChange != null && (
          <p className="mt-0.5 text-[13px] text-g4">
            {signed(weeklyAvgChange, 2)} kg per week on average
            {awayFromGoal && <span className="ml-2 font-medium text-alert">Moving away from your goal</span>}
          </p>
        )}
      </div>
      <div className="grid grid-cols-3 divide-x divide-g2 border-b border-g2">
        <Cell label="Body fat" value={currentBf != null ? fmt(currentBf) : "--"} unit="%" note={currentFatKg != null ? `${fmt(currentFatKg)} kg` : null} />
        <Cell label="Muscle" value={currentMuscle != null ? fmt(currentMuscle) : "--"} unit="%" note={currentMuscleKg != null ? `${fmt(currentMuscleKg)} kg` : null} />
        <Cell label="BMI" value={bmi != null ? fmt(bmi) : "--"} />
      </div>
      <div className="grid grid-cols-3 divide-x divide-g2">
        <Cell label="Fat mass change" value={signed(fatKgChange)} unit="kg" />
        <Cell label="Muscle mass change" value={signed(muscleKgChange)} unit="kg" />
        <Cell label="Weekly rate" value={signed(weeklyAvgChange, 2)} unit="kg" />
      </div>
    </div>
  );
}
