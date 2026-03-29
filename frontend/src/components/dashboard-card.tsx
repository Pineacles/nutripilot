"use client";

import { cn } from "@/lib/utils";

interface Props {
  title: string;
  className?: string;
  span?: string;
  children: React.ReactNode;
}

export function DashboardCard({ title, className = "", span = "col-span-1", children }: Props) {
  return (
    <div
      className={cn(
        "clay-card clay-card-hover p-5",
        span,
        className
      )}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {title}
      </h3>
      <div>{children}</div>
    </div>
  );
}
