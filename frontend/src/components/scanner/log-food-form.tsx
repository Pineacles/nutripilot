import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MEAL_TYPES, MEAL_TYPE_LABELS } from "@/lib/meal-types";
import { FOOD_LOG_BOUNDS } from "@/lib/validation";
import type { FoodDetail, MealType } from "@/lib/types";

interface Props {
  result: FoodDetail;
  justLogged: boolean;
  logDate: string;
  logMode: "grams" | "servings";
  onLogModeChange: (m: "grams" | "servings") => void;
  logQuantity: string;
  onLogQuantityChange: (v: string) => void;
  logMealType: MealType;
  onLogMealTypeChange: (m: MealType) => void;
  onLogDateChange: (v: string) => void;
  onSubmit: () => void;
  pending: boolean;
}

export function LogFoodForm({
  result, justLogged, logDate, logMode, onLogModeChange, logQuantity, onLogQuantityChange,
  logMealType, onLogMealTypeChange, onLogDateChange, onSubmit, pending,
}: Props) {
  const hasServing = !!result.serving_size_g;
  const servingSize = result.serving_size_g;
  const servingLabel = result.serving_label;

  const resolvedGrams =
    logMode === "servings" && servingSize
      ? Number(logQuantity) * servingSize
      : Number(logQuantity);

  return (
    <>
      <Separator className="my-1" />
      {justLogged ? (
        <div className="pill pill-green p-3 flex items-center justify-between gap-3">
          <p className="text-sm text-foreground">Logged {result.name}</p>
          <Link href={`/today?date=${logDate}`}>
            <Button variant="secondary" size="sm" className="text-xs shrink-0">View Today</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {hasServing && (
            <div className="flex gap-1.5">
              {(["grams", "servings"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onLogModeChange(m)}
                  className={`h-9 px-4 rounded-full text-xs font-medium transition-all ${
                    logMode === m ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {m === "grams" ? "Grams" : "Servings"}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">{logMode === "grams" ? "Grams" : "Servings"}</Label>
              <Input
                type="number"
                value={logQuantity}
                onChange={(e) => onLogQuantityChange(e.target.value)}
                min={logMode === "grams" ? FOOD_LOG_BOUNDS.quantity_g.min : FOOD_LOG_BOUNDS.servings.min}
                className="tabular-nums h-9"
              />
              {logMode === "servings" && servingSize && (
                <p className="text-[11px] text-muted-foreground">
                  {logQuantity} × {servingLabel ?? `${servingSize} g`} = {resolvedGrams.toFixed(1)} g
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Meal</Label>
              <select
                value={logMealType}
                onChange={(e) => onLogMealTypeChange(e.target.value as MealType)}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-2 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {MEAL_TYPES.map((mt) => (
                  <option key={mt} value={mt} className="bg-card">{MEAL_TYPE_LABELS[mt]}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1">
              <Label className="text-[11px] text-muted-foreground">Date</Label>
              <Input type="date" value={logDate} onChange={(e) => onLogDateChange(e.target.value)} className="tabular-nums h-9" />
            </div>
          </div>
          <Button onClick={onSubmit} disabled={pending} size="lg" className="w-full">
            {pending ? "Logging..." : "Log this"}
          </Button>
        </div>
      )}
    </>
  );
}
