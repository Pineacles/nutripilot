"use client";

import type { SupplementEntry } from "@/lib/types";

interface Props {
  supplements: SupplementEntry[];
}

export function SupplementChecklist({ supplements }: Props) {
  if (supplements.length === 0) {
    return (
      <div className="rounded-xl border border-[#2a2a30] bg-[#1a1a1f] p-4">
        <p className="text-sm text-[#888]">No supplements logged today</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#2a2a30] bg-[#1a1a1f] p-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-[#888] mb-3">
        Supplements
      </h3>
      <div className="space-y-2">
        {supplements.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-4 w-4 rounded border border-[#4ade80] bg-[#4ade80]/20 flex items-center justify-center">
              <svg className="h-2.5 w-2.5 text-[#4ade80]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <span className="text-sm">{s.name}</span>
              <span className="ml-2 text-xs text-[#888]">
                {s.dose_amount} {s.dose_unit}
              </span>
            </div>
            {s.time_of_day && (
              <span className="text-xs text-[#888] capitalize">{s.time_of_day}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
