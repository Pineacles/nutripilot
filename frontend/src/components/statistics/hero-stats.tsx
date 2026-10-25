"use client";

import type { StatsSummary } from "@/lib/types";
import { useCountUp } from "@/hooks/use-count-up";
import { gapPhrase } from "@/lib/chart-utils";

interface Props {
  data: StatsSummary;
  avgKcal: number;
  targetKcal: number;
  logPct: number;
}

/**
 * The statistics poster: one question ("how much do I eat on a day?"), answered by the period's
 * average kcal in display size, with the target and the gap in words under it, then a ruled row
 * of the other three period facts.
 */
export function HeroStats({ data, avgKcal, targetKcal, logPct }: Props) {
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
      <dl className="grid grid-cols-3 divide-x divide-g2 border-y border-g2">
        <Cell label="Days logged" value={String(data.days_logged)} unit={`/${data.total_days}`} note={`${logPct}%`} first />
        <Cell label="Current streak" value={String(data.current_streak)} unit={data.current_streak === 1 ? "day" : "days"} />
        <Cell label="Supplements" value={`${Math.round(data.supplement_adherence_pct)}`} unit="%" />
      </dl>
    </div>
  );
}

function Cell({ label, value, unit, note, first = false }: { label: string; value: string; unit?: string; note?: string; first?: boolean }) {
  return (
    <div className={`py-3 ${first ? "pr-3" : "px-3"}`}>
      <dt className="text-[12px] text-g4">{label}</dt>
      <dd className="mt-0.5 whitespace-nowrap">
        <span className="text-[22px] font-medium tabular-nums text-ink">{value}</span>
        {unit && <span className="ml-0.5 text-[12px] text-g4">{unit}</span>}
        {note && <span className="ml-1.5 text-[12px] tabular-nums text-g4">{note}</span>}
      </dd>
    </div>
  );
}
