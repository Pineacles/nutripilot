"use client";

import { cn } from "@/lib/utils";

interface Props {
  title: string;
  className?: string;
  span?: string;
  children: React.ReactNode;
}

/** A wide-screen panel (g1, 14px, g2 edge); on phones it is a band under a top rule, no box. */
export function DashboardCard({ title, className = "", span = "col-span-1", children }: Props) {
  return (
    <div
      className={cn(
        "clay-card clay-card-hover p-5",
        span,
        className
      )}
    >
      <h3 className="mb-4 text-[15px] font-medium text-ink">{title}</h3>
      <div>{children}</div>
    </div>
  );
}
