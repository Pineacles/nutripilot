import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dayName } from "@/components/food-log/copy-meal-dialog";
import type { FoodDetail } from "@/lib/types";

interface Props {
  result: FoodDetail;
  /** The day the scanned food was just logged to, or null. */
  loggedOn: string | null;
  /** Opens the shared Log food amount step (units, "+ Unit", last time's amount). */
  onLog: () => void;
}

export function LogFoodForm({ result, loggedOn, onLog }: Props) {
  return (
    <div className="border-t border-g2 pt-4">
      {loggedOn ? (
        <div className="animate-lit flex items-center justify-between gap-3">
          <p className="flex min-w-0 items-center gap-2 text-[15px] text-ink">
            <Check className="h-4 w-4 shrink-0 text-done" aria-hidden="true" />
            <span className="min-w-0">Logged {result.name} for {dayName(loggedOn)}</span>
          </p>
          <Link href={`/today?date=${loggedOn}`}>
            <Button variant="outline" size="sm" className="shrink-0">View day</Button>
          </Link>
        </div>
      ) : (
        <Button onClick={onLog} size="lg" className="w-full">
          Log food
        </Button>
      )}
    </div>
  );
}
