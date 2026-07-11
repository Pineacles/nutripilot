"use client";

import { useEffect, useState } from "react";
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
import { useFoodsSearch, useFoodDetail, useBarcodeLookup } from "@/hooks/queries";
import { useLogFood } from "@/hooks/mutations/food-log";
import { getErrorMessage, ApiError } from "@/lib/api";
import { FOOD_LOG_BOUNDS, validateBounds } from "@/lib/validation";
import { MEAL_TYPES, MEAL_TYPE_LABELS } from "@/lib/meal-types";
import type { FoodDetail, MealType } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The day currently being viewed on the Today page — quantity step defaults to this date. */
  defaultDate: string;
}

type QuantityMode = "grams" | "servings";

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

  // --- Barcode tab state ---
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeFood, setBarcodeFood] = useState<FoodDetail | null>(null);
  const [barcodeError, setBarcodeError] = useState("");
  const barcodeLookup = useBarcodeLookup();

  // --- Quantity step ---
  const activeFood = tab === "search" ? searchedFood ?? null : barcodeFood;
  const step: "browse" | "quantity" = activeFood ? "quantity" : "browse";

  const [mode, setMode] = useState<QuantityMode>("grams");
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
    setMode("grams");
    setQuantityValue("100");
    setMealType("snack");
    setDate(defaultDate);
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
      setBarcodeFood(food);
      setMode(food.serving_size_g ? "servings" : "grams");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setBarcodeError(`Barcode ${code} not found. Try search, or add it as a new food.`);
      } else {
        setBarcodeError(getErrorMessage(err, "Lookup failed — check your connection and try again."));
      }
    }
  }

  useEffect(() => {
    // When a search result resolves to a food with a serving size, default to servings.
    // Deferred to a microtask to avoid react-hooks/set-state-in-effect.
    if (!searchedFood) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setMode(searchedFood.serving_size_g ? "servings" : "grams");
    });
    return () => {
      cancelled = true;
    };
  }, [searchedFood]);

  const quantityNum = Number(quantityValue);
  const bounds = mode === "grams" ? FOOD_LOG_BOUNDS.quantity_g : FOOD_LOG_BOUNDS.servings;
  const quantityError = validateBounds(quantityNum, bounds);

  function handleSubmit() {
    if (!activeFood || quantityError) return;
    logFood.mutate(
      {
        food_id: activeFood.id,
        ...(mode === "grams" ? { quantity_g: quantityNum } : { servings: quantityNum }),
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
                {searching ? (
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
                        onClick={() => food.id && setSelectedSearchId(food.id)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-left transition-colors ${
                          disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-foreground/90">{food.name}</p>
                          {disabled && (
                            <p className="text-[10px] text-muted-foreground">Not in database yet — try Barcode or add it on the Foods page</p>
                          )}
                        </div>
                        <span className="tabular-nums text-muted-foreground text-xs shrink-0 ml-2">
                          {food.kcal != null ? `${Math.round(food.kcal)} kcal` : "--"}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
              {searchPage && searchPage.pages > 1 && (
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
                  onChange={(e) => setBarcodeInput(e.target.value)}
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
            </TabsContent>
          </Tabs>
        )}

        {step === "quantity" && activeFood && (
          <div className="space-y-4 overflow-y-auto thin-scrollbar">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">{activeFood.source}</Badge>
              {activeFood.serving_size_g && (
                <span className="text-xs text-muted-foreground">
                  {activeFood.serving_label || "1 serving"} = {activeFood.serving_size_g}g
                </span>
              )}
            </div>

            {activeFood.serving_size_g && (
              <div className="flex gap-1.5">
                {(["grams", "servings"] as QuantityMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      mode === m ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {m === "grams" ? "Grams" : "Servings"}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {mode === "grams" ? "Quantity (g)" : "Servings"}
              </Label>
              <Input
                type="number"
                value={quantityValue}
                onChange={(e) => setQuantityValue(e.target.value)}
                min={bounds.min}
                max={bounds.max}
                step={mode === "grams" ? 1 : 0.25}
                aria-invalid={!!quantityError}
                className="tabular-nums"
              />
              {quantityError && <p className="text-[11px] text-destructive">{quantityError}</p>}
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
