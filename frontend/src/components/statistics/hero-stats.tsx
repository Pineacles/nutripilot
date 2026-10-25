"use client";

import type { StatsSummary } from "@/lib/types";
import { useCountUp } from "@/hooks/use-count-up";
import { gapPhrase } from "@/lib/chart-utils";

interface Props {
  data: StatsSummary;
  avgKcal: number;
  targetKcal: number;
}

/**
 * The statistics poster: one question ("how much do I eat on a day?"), answered by the period's
 * average kcal in display size, with the target and the gap in words under it, then one quiet line
 * saying how many days were logged.
 */
export function HeroStats({ data, avgKcal, targetKcal }: Props) {
  const avg = Math.round(avgKcal);
  const shown = Math.round(useCountUp(avg));
  const figure = shown.toLocaleString("en-US");
  const empty = data.days_logged === 0;

  if (empty) {
    return (
      <div className="mb-6 border-y border-g2 py-10">
        <p className="text-[22px] font-semibold tracking-[-0.01em] text-ink">Nothing logged in this period</p>
        <p className="mt-1 text-[15px] text-g4">Log a meal on Today, or pick a longer period above.</p>
      </div>
    );
  }

  return (
    <div className="mb-6 border-t border-g2 lg:mb-8">
      <div className="flex min-h-[172px] flex-col justify-end py-5 min-[400px]:min-h-[196px] sm:min-h-[260px]">
        <p className="text-[12px] text-g4">Average per day</p>
        <p
          className={`mt-2 font-bold leading-[0.8] tracking-[-0.045em] text-ink tabular-nums ${
            figure.length <= 3 ? "text-[6.5rem] min-[400px]:text-[7.5rem] sm:text-[8.5rem]" : "text-[5.5rem] min-[400px]:text-[6.25rem] sm:text-[8rem]"
          }`}
        >
          {figure}
        </p>
        <p className="mt-3 text-[13px] text-g5 tabular-nums">
          kcal a day, target {targetKcal.toLocaleString("en-US")},{" "}
          <span className="text-ink">{gapPhrase(avg, targetKcal)}</span>
        </p>
      </div>
      <p className="border-y border-g2 py-3 text-[13px] tabular-nums text-g4">
        {data.days_logged} of {data.total_days} days logged
      </p>
    </div>
  );
}
