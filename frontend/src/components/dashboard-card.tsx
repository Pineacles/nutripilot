"use client";

import { cn } from "@/lib/utils";

interface Props {
  title: string;
  className?: string;
  span?: string;
  /** Quiet text right of the title (a count, a goal). */
  aside?: React.ReactNode;
  children: React.ReactNode;
}

/** A wide-screen panel (g1, 14px, g2 edge); on phones it is a band under a top rule, no box. */
export function DashboardCard({ title, className = "", span = "col-span-1", aside, children }: Props) {
  return (
    <div
      className={cn(
        "clay-card clay-card-hover p-5",
        span,
        className
      )}
    >
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-medium text-ink">{title}</h3>
        {aside && <span className="text-[13px] tabular-nums text-g4">{aside}</span>}
      </div>
      <div>{children}</div>
    </div>
  );
}
