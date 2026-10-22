"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFoodsSearch, useFoodDetail, useBarcodeLookup, useRecentFoods } from "@/hooks/queries";
import { useLogFood } from "@/hooks/mutations/food-log";
import { getErrorMessage, ApiError } from "@/lib/api";
import { FOOD_LOG_BOUNDS, validateBounds } from "@/lib/validation";
import { MEAL_TYPES, MEAL_TYPE_LABELS } from "@/lib/meal-types";
import { convertAmount, defaultPortion, formatPortion, toGrams } from "@/lib/portion";
import type { FoodDetail, LogUnit, MealType, RecentFood } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The day currently being viewed on the Today page: quantity step defaults to this date. */
  defaultDate: string;
}

export function AddFoodDialog({ open, onOpenChange, defaultDate }: Props) {
  const [tab, setTab] = useState<"search" | "barcode">("search");

  // --- Search tab state ---
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedSearchId, setSelectedSearchId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: searchPage, isFetching: searching } = useFoodsSearch(debouncedQuery, page, 20);
  const { data: searchedFood } = useFoodDetail(selectedSearchId);
  const { data: recents } = useRecentFoods(open);
  const showRecents = tab === "search" && debouncedQuery.trim() === "" && query.trim() === "" && !!recents?.length;

  // --- Barcode tab state ---
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeFood, setBarcodeFood] = useState<FoodDetail | null>(null);
  const [barcodeError, setBarcodeError] = useState("");
  const [missingBarcode, setMissingBarcode] = useState("");
  const barcodeLookup = useBarcodeLookup();

  // --- Quantity step ---
  const activeFood = tab === "search" ? searchedFood ?? null : barcodeFood;
  const step: "browse" | "quantity" = activeFood ? "quantity" : "browse";

  const [unit, setUnit] = useState<LogUnit>("g");
  const [quantityValue, setQuantityValue] = useState("100");
  const [mealType, setMealType] = useState<MealType>("snack");
  const [date, setDate] = useState(defaultDate);

  const logFood = useLogFood();

  function resetAll() {
    setTab("search");
    setQuery("");
    setDebouncedQuery("");
    setPage(1);
    setSelectedSearchId(null);
    setBarcodeInput("");
    setBarcodeFood(null);
    setBarcodeError("");
    setMissingBarcode("");
    setUnit("g");
    setQuantityValue("100");
    setMealType("snack");
    setDate(defaultDate);
  }

  /** Start the amount step: the amount used last time for this food, else one serving (or 100 g). */
  function prefill(food: { id: string; serving_size_g?: number | null }) {
    const last: RecentFood | undefined = recents?.find((r) => r.id === food.id);
    if (last && (last.last_unit === "g" || food.serving_size_g)) {
      setUnit(last.last_unit);
      setQuantityValue(String(last.last_amount));
      setMealType(last.last_meal_type);
      return;
    }
    const start = defaultPortion(food.serving_size_g);
    setUnit(start.unit);
    setQuantityValue(String(start.amount));
    setMealType("snack");
  }

  function pick(food: { id: string; serving_size_g?: number | null }) {
    prefill(food);
    setSelectedSearchId(food.id);
  }

  function switchUnit(next: LogUnit) {
    if (next === unit || !activeFood) return;
    const current = Number(quantityValue);
    if (Number.isFinite(current) && current > 0) {
      setQuantityValue(String(convertAmount(current, unit, next, activeFood.serving_size_g)));
    }
    setUnit(next);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetAll();
    onOpenChange(next);
  }

  function backToBrowse() {
    setSelectedSearchId(null);
    setBarcodeFood(null);
    setBarcodeError("");
  }

  async function handleBarcodeLookup(e: React.FormEvent) {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;
    setBarcodeError("");
    try {
      const food = await barcodeLookup.mutateAsync(code);
      prefill(food);
      setBarcodeFood(food);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setBarcodeError(`Barcode ${code} not found. Try search, or add it as a new food.`);
        setMissingBarcode(code);
      } else {
        setBarcodeError(getErrorMessage(err, "Lookup failed, check your connection and try again."));
      }
    }
  }

  const quantityNum = Number(quantityValue);
  // A serving amount only makes sense for a food that has a serving size.
  const effectiveUnit: LogUnit = unit === "serving" && activeFood?.serving_size_g ? "serving" : "g";
  const bounds = effectiveUnit === "g" ? FOOD_LOG_BOUNDS.quantity_g : FOOD_LOG_BOUNDS.servings;
  const quantityError = validateBounds(quantityNum, bounds);
  const grams = toGrams(quantityNum || 0, effectiveUnit, activeFood?.serving_size_g);
  const per100 = activeFood?.nutrients;
  const scaled = (key: string) => (per100?.[key] != null ? (per100[key]! * grams) / 100 : null);

  function handleSubmit() {
    if (!activeFood || quantityError) return;
    logFood.mutate(
      {
        food_id: activeFood.id,
        ...(effectiveUnit === "g" ? { quantity_g: quantityNum } : { servings: quantityNum }),
        meal_type: mealType,
        date,
      },
      {
        onSuccess: () => {
          toast.success(`Logged ${activeFood.name}`);
          handleOpenChange(false);
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{step === "quantity" ? activeFood?.name : "Log food"}</DialogTitle>
        </DialogHeader>

        {step === "browse" && (
          <Tabs value={tab} onValueChange={(v) => setTab(v as "search" | "barcode")}>
            <TabsList className="w-full">
              <TabsTrigger value="search" className="flex-1">Search</TabsTrigger>
              <TabsTrigger value="barcode" className="flex-1">Barcode</TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="mt-3">
              <Input
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder="Search foods..."
                className="h-10"
                autoFocus
              />
              <div className="mt-3 max-h-[45vh] overflow-y-auto thin-scrollbar space-y-1">
                {showRecents ? (
                  <>
                    <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">Recent</p>
                    {recents!.map((food) => (
                      <button
                        key={food.id}
                        type="button"
                        onClick={() => pick(food)}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-left transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-foreground/90">{food.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Last time {formatPortion(food.last_amount, food.last_unit, food.last_quantity_g)}
                          </p>
                        </div>
                        <span className="tabular-nums text-muted-foreground text-xs shrink-0 ml-2">
                          {food.kcal != null ? `${Math.round((food.kcal * food.last_quantity_g) / 100)} kcal` : "--"}
                        </span>
                      </button>
                    ))}
                  </>
                ) : searching ? (
                  [1, 2, 3].map((i) => <div key={i} className="h-10 rounded-lg bg-muted/50 animate-pulse" />)
                ) : !searchPage || searchPage.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No foods found</p>
                ) : (
                  searchPage.items.map((food) => {
                    const disabled = !food.id;
                    return (
                      <button
                        key={food.id ?? food.name}
                        type="button"
                        disabled={disabled}
                        onClick={() => food.id && pick({ id: food.id, serving_size_g: food.serving_size_g })}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-left transition-colors ${
                          disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-foreground/90">{food.name}</p>
                          {!disabled && food.serving_size_g ? (
                            <p className="text-[11px] text-muted-foreground truncate">
                              {food.serving_label || "1 serving"} = {food.serving_size_g} g
                            </p>
                          ) : null}
                          {disabled && (
                            <p className="text-[10px] text-muted-foreground">Not in database yet, try Barcode or add it on the Foods page</p>
                          )}
                        </div>
                        <span className="tabular-nums text-muted-foreground text-xs shrink-0 ml-2">
                          {food.kcal != null ? (
                            <span className="block text-right leading-tight">
                              {Math.round(food.kcal)} kcal
                              <span className="block text-[10px] text-muted-foreground/70">per 100 g</span>
                            </span>
                          ) : "--"}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
              {!showRecents && searchPage && searchPage.pages > 1 && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                  <Button variant="ghost" size="xs" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                  <span className="text-xs text-muted-foreground tabular-nums">{page} / {searchPage.pages}</span>
                  <Button variant="ghost" size="xs" disabled={page === searchPage.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="barcode" className="mt-3">
              <form onSubmit={handleBarcodeLookup} className="flex gap-2">
                <Input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => { setBarcodeInput(e.target.value); setMissingBarcode(""); }}
                  placeholder="Enter barcode..."
                  className="flex-1 h-10 font-mono"
                  autoFocus
                />
                <Button type="submit" disabled={!barcodeInput.trim() || barcodeLookup.isPending} size="lg">
                  {barcodeLookup.isPending ? "..." : "Look up"}
                </Button>
              </form>
              {barcodeError && (
                <p className="text-xs text-destructive mt-2">{barcodeError}</p>
              )}
              {missingBarcode && (
                <Link
                  href={`/foods?new=1&barcode=${encodeURIComponent(missingBarcode)}`}
                  className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                >
                  Add {missingBarcode} as a new food
                </Link>
              )}
            </TabsContent>
          </Tabs>
        )}

        {step === "quantity" && activeFood && (
          <div className="space-y-4 overflow-y-auto thin-scrollbar">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">{activeFood.source}</Badge>
              {activeFood.serving_size_g && (
                <span className="text-xs text-muted-foreground">
                  {activeFood.serving_label || "1 serving"} = {activeFood.serving_size_g} g
                </span>
              )}
            </div>

            {activeFood.serving_size_g && (
              <div className="flex gap-1.5">
                {(["serving", "g"] as LogUnit[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchUnit(m)}
                    aria-pressed={effectiveUnit === m}
                    className={`h-9 px-3.5 rounded-full text-xs font-medium transition-colors duration-100 ${
                      effectiveUnit === m ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {m === "g" ? "Grams" : "Servings"}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {effectiveUnit === "g" ? "Quantity (g)" : "Servings"}
              </Label>
              <Input
                type="number"
                value={quantityValue}
                onChange={(e) => setQuantityValue(e.target.value)}
                min={bounds.min}
                max={bounds.max}
                step={effectiveUnit === "g" ? 1 : 0.25}
                inputMode="decimal"
                aria-invalid={!!quantityError}
                className="tabular-nums"
              />
              {quantityError ? (
                <p className="text-[11px] text-destructive">{quantityError}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {effectiveUnit === "serving" && <>{Math.round(grams * 10) / 10} g · </>}
                  <span className="font-medium text-foreground">
                    {scaled("kcal") != null ? `${Math.round(scaled("kcal")!)} kcal` : "kcal unknown"}
                  </span>
                  {scaled("protein") != null && ` · ${Math.round(scaled("protein")!)} g protein`}
                  {scaled("carbs") != null && ` · ${Math.round(scaled("carbs")!)} g carbs`}
                  {scaled("fat") != null && ` · ${Math.round(scaled("fat")!)} g fat`}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Meal</Label>
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value as MealType)}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  {MEAL_TYPES.map((mt) => (
                    <option key={mt} value={mt} className="bg-card">{MEAL_TYPE_LABELS[mt]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="tabular-nums"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={handleSubmit} disabled={!!quantityError || logFood.isPending} size="lg" className="flex-1">
                {logFood.isPending ? "Logging..." : "Log food"}
              </Button>
              <Button onClick={backToBrowse} variant="outline" size="lg">
                Back
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
