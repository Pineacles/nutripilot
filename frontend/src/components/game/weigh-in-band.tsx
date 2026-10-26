"use client";

import type { WeightGame } from "@/lib/game-types";

/**
 * The weigh-in rhythm: three cells for this week (a week counts with three weigh-ins, scale syncs
 * included) and the run of weeks that counted. Consistency is what is celebrated, not the number.
 */
export function WeighInBand({ weight }: { weight: WeightGame }) {
  const n = Math.min(3, weight.this_week_weigh_ins);
  return (
    <section aria-label="Weigh-in rhythm" className="flex items-center gap-4 border-b border-g2 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-g4">Weigh-in weeks</p>
        <p className="mt-1 whitespace-nowrap">
          <span className="text-[22px] font-medium tabular-nums text-ink">{weight.weigh_in_weeks_current}</span>
          <span className="ml-1 text-[12px] text-g4">in a row, best {weight.weigh_in_weeks_longest}</span>
        </p>
      </div>
      <div className="text-right">
        <p className="text-[12px] text-g4">This week</p>
        <ol className="mt-1.5 flex justify-end gap-1" aria-label={`${weight.this_week_weigh_ins} of 3 weigh-ins this week`}>
          {[0, 1, 2].map((i) => (
            <li key={i} className={`size-4 ${i < n ? "animate-stamp bg-ink" : "border border-g3"}`} style={{ animationDelay: `${i * 90}ms` }} />
          ))}
        </ol>
      </div>
    </section>
  );
}
