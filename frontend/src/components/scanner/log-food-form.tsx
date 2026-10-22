import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
    <>
      <Separator className="my-1" />
      {loggedOn ? (
        <div className="pill pill-green p-3 flex items-center justify-between gap-3">
          <p className="text-sm text-foreground">Logged {result.name} for {dayName(loggedOn)}</p>
          <Link href={`/today?date=${loggedOn}`}>
            <Button variant="secondary" size="sm" className="h-10 text-xs shrink-0">View day</Button>
          </Link>
        </div>
      ) : (
        <Button onClick={onLog} size="lg" className="h-11 w-full">
          Log food
        </Button>
      )}
    </>
  );
}
