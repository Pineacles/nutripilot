"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  className?: string;
  children: React.ReactNode;
}

export function DashboardCard({ title, className = "", children }: Props) {
  return (
    <Card
      className={cn(
        "rounded-2xl border-border/50 shadow-md transition-shadow duration-300 hover:shadow-lg",
        className
      )}
    >
      <CardHeader className="pb-0">
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
