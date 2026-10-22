"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
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
import { useFoodsSearch, useFoodDetail, useBarcodeLookup, useRecentFoods, queryKeys } from "@/hooks/queries";
import { useLogFood } from "@/hooks/mutations/food-log";
import { getErrorMessage, ApiError } from "@/lib/api";
import { FOOD_LOG_BOUNDS, validateBounds } from "@/lib/validation";
import { MEAL_TYPES, MEAL_TYPE_LABELS, mealForTime } from "@/lib/meal-types";
import { todayStr } from "@/lib/dates";
import { sourceLabel } from "@/lib/format";
import { BARCODE_PROBLEM_TEXT, barcodeProblem } from "@/lib/barcode";
import { convertAmount, defaultPortion, fmtGrams, formatPortion, portionPayload, portionUnits, unitKeyFor } from "@/lib/portion";
import type { FoodDetail, MealType } from "@/lib/types";
import { UnitPicker } from "./unit-picker";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The day currently being viewed on the Today page: quantity step defaults to this date. */
  defaultDate: string;
  /** Open straight on the amount step for this food (the Foods page and Scanner "Log food" buttons). */
  initialFoodId?: string;
  /** Called after an entry was saved, with the day it went to. */
  onLogged?: (date: string) => void;
}

export function AddFoodDialog({ open, onOpenChange, defaultDate, initialFoodId, onLogged }: Props) {
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
  const { data: recents } = useRecentFoods(open);
  const showRecents = tab === "search" && debouncedQuery.trim() === "" && query.trim() === "" && !!recents?.length;

  // --- Barcode tab state ---
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeFoodId, setBarcodeFoodId] = useState<string | null>(null);
  const [barcodeError, setBarcodeError] = useState("");
  const [missingBarcode, setMissingBarcode] = useState("");
  const barcodeLookup = useBarcodeLookup();
  const queryClient = useQueryClient();

  // --- Quantity step ---
  // Both tabs read the picked food through the detail query, so a unit added here shows up at once.
  const pickedId = tab === "search" ? selectedSearchId : barcodeFoodId;
  const { data: detail, isError: detailError, refetch: refetchDetail } = useFoodDetail(pickedId);
  // Placeholder data from the previous pick must not stand in for the new one.
  const activeFood: FoodDetail | null = pickedId && detail?.id === pickedId ? detail : null;
  const step: "browse" | "loading" | "quantity" = activeFood ? "quantity" : pickedId ? "loading" : "browse";

  const [unitKey, setUnitKey] = useState("g");
  const [quantityValue, setQuantityValue] = useState("100");
  const [mealType, setMealType] = useState<MealType>(() => mealForTime());
  const [date, setDate] = useState(defaultDate);
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);
  const units = portionUnits(activeFood);

  const logFood = useLogFood();

  function resetAll() {
    setTab("search");
    setQuery("");
    setDebouncedQuery("");
    setPage(1);
    setSelectedSearchId(null);
    setBarcodeInput("");
    setBarcodeFoodId(null);
    setBarcodeError("");
    setMissingBarcode("");
    setUnitKey("g");
    setQuantityValue("100");
    setMealType(mealForTime());
    setDate(defaultDate);
    setPrefilledFor(null);
  }

  // Each time it opens: the day being viewed (it may have changed since the last open), and the
  // food it was opened for. Set during render, so the first frame already shows the right date.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDate(defaultDate);
      if (initialFoodId) {
        setTab("search");
        setSelectedSearchId(initialFoodId);
        setPrefilledFor(null);
      }
    }
  }

  // Start the amount step once the food (with its units) has loaded: the amount used last time for
  // this food, else one serving (or 100 g). Set during render so there is no flash of the old amount.
  if (activeFood && prefilledFor !== activeFood.id) {
    setPrefilledFor(activeFood.id);
    const last = recents?.find((r) => r.id === activeFood.id);
    const lastKey = last ? unitKeyFor(units, last.last_unit, last.last_unit_label) : null;
    if (last && (last.last_unit === "g" || lastKey !== "g")) {
      setUnitKey(lastKey!);
      setQuantityValue(String(last.last_amount));
    } else if (last) {
      // Last time's unit is gone (serving removed): offer the same weight in grams.
      setUnitKey("g");
      setQuantityValue(fmtGrams(last.last_quantity_g));
    } else {
      const start = defaultPortion(activeFood.serving_size_g);
      setUnitKey(start.unitKey);
      setQuantityValue(String(start.amount));
    }
    // Logging now: the meal for the time of day. Another day: the meal it was logged in last time.
    setMealType(date === todayStr() ? mealForTime() : last?.last_meal_type ?? mealForTime());
  }

  const unit = units.find((u) => u.key === unitKey) ?? units[units.length - 1];

  function pick(food: { id: string }) {
    setPrefilledFor(null);
    setSelectedSearchId(food.id);
  }

  function switchUnit(next: string) {
    const to = units.find((u) => u.key === next);
    if (!to || next === unit.key) return;
    const current = Number(quantityValue);
    if (Number.isFinite(current) && current > 0) {
      setQuantityValue(String(convertAmount(current, unit, to)));
    }
    setUnitKey(next);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetAll();
    onOpenChange(next);
  }

  function backToBrowse() {
    setSelectedSearchId(null);
    setBarcodeFoodId(null);
    setBarcodeError("");
    setPrefilledFor(null);
  }

  async function handleBarcodeLookup(e: React.FormEvent) {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;
    setBarcodeError("");
    try {
      const food = await barcodeLookup.mutateAsync(code);
      queryClient.setQueryData(queryKeys.foodDetail(food.id), food);
      setPrefilledFor(null);
      setBarcodeFoodId(food.id);
    } catch (err) {
      const problem = barcodeProblem(code);
      if (err instanceof ApiError && err.status === 404 && problem) {
        // Saving a food under a counter label or a misread code would only catch the wrong pack later.
        setBarcodeError(BARCODE_PROBLEM_TEXT[problem]);
      } else if (err instanceof ApiError && err.status === 404) {
        setBarcodeError(`Barcode ${code} not found. Try search, or add it as a new food.`);
        setMissingBarcode(code);
      } else {
        setBarcodeError(getErrorMessage(err, "Lookup failed, check your connection and try again."));
      }
    }
  }

  const quantityNum = Number(quantityValue);
  const inGrams = unit.key === "g";
  const bounds = inGrams ? FOOD_LOG_BOUNDS.quantity_g : FOOD_LOG_BOUNDS.servings;
  const grams = (quantityNum || 0) * unit.grams;
  const quantityError =
    validateBounds(quantityNum, bounds) ?? (grams > FOOD_LOG_BOUNDS.quantity_g.max ? `That is ${Math.round(grams)} g, more than ${FOOD_LOG_BOUNDS.quantity_g.max} g` : null);
  const per100 = activeFood?.nutrients;
  const scaled = (key: string) => (per100?.[key] != null ? (per100[key]! * grams) / 100 : null);

  function handleSubmit() {
    if (!activeFood || quantityError) return;
    logFood.mutate(
      {
        food_id: activeFood.id,
        ...portionPayload(quantityNum, unit),
        meal_type: mealType,
        date,
      },
      {
        onSuccess: () => {
          toast.success(`Logged ${activeFood.name}`);
          onLogged?.(date);
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
                            Last time {formatPortion(food.last_amount, food.last_unit, food.last_quantity_g, food.last_unit_label)}
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
                        onClick={() => food.id && pick({ id: food.id })}
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

        {step === "loading" && (
          detailError ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-destructive">Couldn&apos;t load this food. Check your connection and try again.</p>
              <div className="flex gap-2">
                <Button onClick={() => refetchDetail()} size="lg" className="flex-1">Try again</Button>
                <Button onClick={backToBrowse} variant="outline" size="lg">Back</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-1" aria-busy="true" aria-label="Loading food">
              <div className="flex gap-1.5">
                {[1, 2, 3].map((i) => <div key={i} className="h-10 w-20 rounded-full bg-muted/40 animate-pulse" />)}
              </div>
              <div className="h-9 rounded-lg bg-muted/40 animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-muted/40 animate-pulse" />
            </div>
          )
        )}

        {step === "quantity" && activeFood && (
          <div className="space-y-4 overflow-y-auto thin-scrollbar">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">{sourceLabel(activeFood.source, activeFood.is_mine)}</Badge>
            </div>

            <UnitPicker
              foodId={activeFood.id}
              units={units}
              value={unit.key}
              onChange={switchUnit}
              onAdded={(serving) => {
                setUnitKey(serving.id);
                setQuantityValue("1");
              }}
              servingLabel={activeFood.serving_label}
            />

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {inGrams ? "Quantity (g)" : unit.key === "serving" ? "Servings" : `Amount (${unit.label})`}
              </Label>
              <Input
                type="number"
                value={quantityValue}
                onChange={(e) => setQuantityValue(e.target.value)}
                min={bounds.min}
                max={bounds.max}
                step={inGrams ? 1 : 0.25}
                inputMode="decimal"
                aria-invalid={!!quantityError}
                className="tabular-nums"
              />
              {quantityError ? (
                <p className="text-[11px] text-destructive">{quantityError}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {!inGrams && <>{Math.round(grams * 10) / 10} g · </>}
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
