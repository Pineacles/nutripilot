"use client";

import type { SupplementEntry } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";

interface Props {
  supplements: SupplementEntry[];
}

export function SupplementsCard({ supplements }: Props) {
  return (
    <DashboardCard title="Supplements" className="col-span-1">
      {supplements.length === 0 ? (
        <p className="text-sm text-white/30">No supplements today</p>
      ) : (
        <div className="space-y-3">
          {supplements.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-md border border-[#22c55e]/40 bg-[#22c55e]/10 flex items-center justify-center shrink-0">
                <svg
                  className="h-3 w-3 text-[#22c55e]"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/80 truncate">{s.name}</p>
                <p className="text-xs text-white/30">
                  {s.dose_amount} {s.dose_unit}
                  {s.time_of_day && ` · ${s.time_of_day}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
