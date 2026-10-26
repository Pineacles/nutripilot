"use client";

import { fmt } from "@/lib/utils";
import { useCountUp } from "@/hooks/use-count-up";
import { parseLocal } from "@/lib/dates";
import type { WeightGame } from "@/lib/game-types";

interface Props {
  currentWeight: number | null;
  weightChange: number | null;
  /** Length of the chosen period, for the sentence under the weight. */
  days: number;
  weeklyAvgChange: number | null;
  /** The smoothed trend from the motivation layer; when present it is the headline. */
  trend?: WeightGame | null;
}

export const signed = (v: number | null, decimals = 1) =>
  v == null ? "--" : `${v > 0 ? "+" : v < 0 ? "-" : ""}${fmt(Math.abs(v), decimals)}`;

function periodWords(days: number) {
  return days === 365 ? "1 year" : `${days} days`;
}

/** The answer to the page's one question: what do I weigh now, and how has it moved. */
export function HeroStats({ currentWeight, weightChange, days, weeklyAvgChange, trend: game }: Props) {
  if (game) return <TrendHero game={game} />;
  return <ScaleHero currentWeight={currentWeight} weightChange={weightChange} days={days} weeklyAvgChange={weeklyAvgChange} />;
}

const dayWord = (d: string) => parseLocal(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

/**
 * The trend weight as the headline: the scale swings with water and salt from day to day, the
 * smoothed trend shows where the body is going. The day's reading sits beside it, smaller. A new
 * low on the trend toward the goal draws one ink ring around the figure.
 */
function TrendHero({ game }: { game: WeightGame }) {
  const shown = useCountUp(game.trend_kg, 600);
  const change = game.trend_change_28d ?? game.trend_change_7d;
  const span = game.trend_change_28d != null ? "4 weeks" : "a week";
  return (
    <div className="border-b border-g2 pb-5 pt-4 tabular-nums">
      <p className="flex items-baseline justify-between gap-3 text-[12px] text-g4">
        <span>Trend weight</span>
        <span>
          Scale <span className="text-g5">{fmt(game.raw_kg)} kg</span>, {dayWord(game.raw_date)}
        </span>
      </p>
      <p className="mt-3 flex items-baseline gap-2 text-ink">
        <span className={`text-[6.5rem] font-bold leading-[0.8] tracking-[-0.045em] sm:text-[7.5rem] ${game.is_trend_low ? "animate-ink-ring" : ""}`}>
          {fmt(shown)}
        </span>
        <span className="text-[22px] font-medium text-g4">kg</span>
      </p>
      <p className="mt-4 text-[15px] text-ink">
        {change == null ? "The trend needs a few more weigh-ins" : change === 0 ? `Steady over ${span}` : `${signed(change)} kg over ${span}`}
        {game.is_trend_low && <span className="text-g5">, a new low on the trend</span>}
      </p>
      {game.goal_kg != null && (
        <p className="mt-1 text-[13px] text-g5">
          {game.direction === "reached"
            ? `At your goal of ${fmt(game.goal_kg)} kg`
            : game.eta_date
              ? `Goal ${fmt(game.goal_kg)} kg around ${parseLocal(game.eta_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} at this pace`
              : `Goal ${fmt(game.goal_kg)} kg`}
        </p>
      )}
    </div>
  );
}

function ScaleHero({ currentWeight, weightChange, days, weeklyAvgChange }: Omit<Props, "trend">) {
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
