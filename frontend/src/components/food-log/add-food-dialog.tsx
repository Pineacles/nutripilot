"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronLeft, Plus, ScanBarcode, Search, X } from "lucide-react";
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
import { useDeleteFoodLog, useLogFood } from "@/hooks/mutations/food-log";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useTracked } from "@/hooks/use-tracked";
import { apiFetch, getErrorMessage, ApiError } from "@/lib/api";
import { FOOD_LOG_BOUNDS, validateBounds } from "@/lib/validation";
import { MEAL_TYPES, MEAL_TYPE_LABELS, mealForTime } from "@/lib/meal-types";
import { todayStr } from "@/lib/dates";
import { sourceLabel } from "@/lib/format";
import { BARCODE_PROBLEM_TEXT, barcodeProblem } from "@/lib/barcode";
import { BarcodeCamera } from "@/components/scanner/barcode-camera";
import { convertAmount, defaultPortion, fmtGrams, formatPortion, portionPayload, portionUnits, unitKeyFor } from "@/lib/portion";
import type { FoodDetail, FoodLogCreateInput, MealType, RecentFood } from "@/lib/types";
import { dayName } from "./copy-meal-dialog";
import { UnitPicker } from "./unit-picker";
import { plateOf } from "@/lib/plates";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The day currently being viewed on the Today page: quantity step defaults to this date. */
  defaultDate: string;
  /** Open straight on the amount step for this food (the Foods page and Scanner "Log food" buttons). */
  initialFoodId?: string;
  /** Open with this meal chosen (a meal's own + on the Today page). */
  initialMeal?: MealType;
  /** Called after an entry was saved, with the day it went to. */
  onLogged?: (date: string) => void;
}

/**
 * Log food. Desktop: a centered dialog with Search and Barcode tabs. Phone: a full height bottom
 * sheet built for logging the same food again (docs/design-vision.md): recents with a one tap +,
 * the search bar at the bottom with the camera in it, and it stays open for the next food.
 */
export function AddFoodDialog({ open, onOpenChange, defaultDate, initialFoodId, initialMeal, onLogged }: Props) {
  const isPhone = useMediaQuery("(max-width: 767px)");
  const { shows } = useTracked();
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
  const [mealType, setMealType] = useState<MealType>(() => mealForTime());
  const recentsQuery = useRecentFoods(open, mealType);
  const freshRecents = recentsQuery.data;
  const recentsReady = recentsQuery.isFetched || recentsQuery.isError;
  // Logging refreshes the recents; keep the order they had when the sheet opened, so the row under
  // your thumb does not jump away between two taps.
  const [recentOrder, setRecentOrder] = useState<{ meal: MealType; ids: string[] } | null>(null);
  if (open && freshRecents && !recentsQuery.isPlaceholderData && (recentOrder === null || recentOrder.meal !== mealType)) {
    setRecentOrder({ meal: mealType, ids: freshRecents.map((r) => r.id) });
  }
  if (!open && recentOrder !== null) setRecentOrder(null);
  const recents = freshRecents && recentOrder
    ? [...freshRecents].sort((a, b) => {
        const ia = recentOrder.ids.indexOf(a.id), ib = recentOrder.ids.indexOf(b.id);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      })
    : freshRecents;
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
  // A meal picked by hand (the sheet's meal chip, or a meal's own +) is kept for every food.
  const [mealChosen, setMealChosen] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);
  const units = portionUnits(activeFood);

  // Phone: foods logged since the sheet opened (id -> times), for the check marks and the Done bar.
  const [logged, setLogged] = useState<Record<string, string[]>>({});
  const [quickPending, setQuickPending] = useState<string | null>(null);
  const loggedCount = Object.values(logged).reduce((a, ids) => a + ids.length, 0);

  const logFood = useLogFood();
  const deleteLog = useDeleteFoodLog();

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
    setMealChosen(false);
    setDate(defaultDate);
    setPrefilledFor(null);
    setLogged({});
  }

  // Each time it opens: the day being viewed (it may have changed since the last open), and the
  // food it was opened for. Set during render, so the first frame already shows the right date.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDate(defaultDate);
      if (initialMeal) {
        setMealType(initialMeal);
        setMealChosen(true);
      }
      if (initialFoodId) {
        setTab("search");
        setSelectedSearchId(initialFoodId);
        setPrefilledFor(null);
      }
    }
  }

  // Start the amount step once the food (with its units) has loaded: the amount used last time for
  // this food, else one serving (or 100 g). Set during render so there is no flash of the old amount.
  if (activeFood && recentsReady && prefilledFor !== activeFood.id) {
    setPrefilledFor(activeFood.id);
    const last = recents?.find((r) => r.id === activeFood.id);
    const lastKey = last ? unitKeyFor(units, last.last_unit, last.last_unit_label) : null;
    if (last && (last.last_unit === "g" || lastKey !== "g")) {
      setUnitKey(lastKey!);
      setQuantityValue(lastKey === "g" ? fmtGrams(last.last_amount) : String(last.last_amount));
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
    // The phone sheet shows its meal chip all along, so what it shows is what gets logged.
    if (!mealChosen && !isPhone) setMealType(date === todayStr() ? mealForTime() : last?.last_meal_type ?? mealForTime());
  }

  const unit = units.find((u) => u.key === unitKey) ?? units[units.length - 1];

  function pick(food: { id: string }) {
    setPrefilledFor(null);
    setSelectedSearchId(food.id);
  }

  function chooseMeal(meal: MealType) {
    setMealType(meal);
    setMealChosen(true);
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

  function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    lookupCode(barcodeInput.trim());
  }

  function handleScanned(code: string) {
    setBarcodeInput(code);
    setMissingBarcode("");
    lookupCode(code);
  }

  async function lookupCode(code: string) {
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
        setBarcodeError(`Barcode ${code} not found. Search for it by name, or add it as a new food.`);
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

  function forget(foodId: string, logId: string) {
    setLogged((prev) => {
      const ids = (prev[foodId] ?? []).filter((id) => id !== logId);
      const next = { ...prev, [foodId]: ids };
      if (!ids.length) delete next[foodId];
      return next;
    });
  }

  function undoLog(foodId: string, logId: string) {
    deleteLog.mutate(logId, {
      onSuccess: () => {
        forget(foodId, logId);
        toast.success("Removed");
      },
      onError: (err) => toast.error(getErrorMessage(err, "Couldn't undo, remove it from the meal instead.")),
    });
  }

  /** Phone: logged, ticked in the list, Undo in the toast, and the sheet stays open for the next food. */
  function afterPhoneLog(foodId: string, name: string, logId: string) {
    setLogged((prev) => ({ ...prev, [foodId]: [...(prev[foodId] ?? []), logId] }));
    navigator.vibrate?.(30);
    onLogged?.(date);
    toast.success(`Logged ${name}`, {
      description: `${MEAL_TYPE_LABELS[mealType]}, ${dayName(date)}`,
      action: { label: "Undo", onClick: () => undoLog(foodId, logId) },
    });
  }

  function handleSubmit() {
    if (!activeFood || quantityError) return;
    const food = activeFood;
    logFood.mutate(
      {
        food_id: food.id,
        ...portionPayload(quantityNum, unit),
        meal_type: mealType,
        date,
      },
      {
        onSuccess: (entry) => {
          if (isPhone) {
            afterPhoneLog(food.id, food.name, entry.id);
            backToBrowse();
            return;
          }
          toast.success(`Logged ${food.name}`);
          onLogged?.(date);
          handleOpenChange(false);
        },
      }
    );
  }

  /** One tap on a recent food's +: the same amount and unit as last time, into the chosen meal. */
  async function quickLog(food: RecentFood) {
    setQuickPending(food.id);
    try {
      let portion: Pick<FoodLogCreateInput, "quantity_g" | "servings" | "serving_id">;
      if (food.last_unit === "serving" && food.last_unit_label) {
        // A named serving ("slice") is per person: find its id on the food.
        const full = await queryClient.fetchQuery({
          queryKey: queryKeys.foodDetail(food.id),
          queryFn: () => apiFetch<FoodDetail>(`/api/dashboard/foods/${food.id}`),
        });
        const foodUnits = portionUnits(full);
        const key = unitKeyFor(foodUnits, food.last_unit, food.last_unit_label);
        const u = foodUnits.find((x) => x.key === key);
        portion = u && u.key !== "g" ? portionPayload(food.last_amount, u) : { quantity_g: food.last_quantity_g };
      } else {
        portion = food.last_unit === "serving" ? { servings: food.last_amount } : { quantity_g: food.last_quantity_g };
      }
      const entry = await logFood.mutateAsync({ food_id: food.id, ...portion, meal_type: mealType, date });
      afterPhoneLog(food.id, food.name, entry.id);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't log it, try again."));
    } finally {
      setQuickPending(null);
    }
  }

  // --- Pieces both layouts use ---

  const preview = quantityError ? (
    <p className="text-[11px] text-destructive">{quantityError}</p>
  ) : (
    <p className="text-[11px] text-muted-foreground tabular-nums">
      {!inGrams && <>{Math.round(grams * 10) / 10} g · </>}
      <span className="font-medium text-foreground">
        {scaled("kcal") != null ? `${Math.round(scaled("kcal")!)} kcal` : "kcal unknown"}
      </span>
      {(["protein", "carbs", "fat"] as const)
        .filter((k) => shows(k) && scaled(k) != null)
        .map((k) => ` · ${Math.round(scaled(k)!)} g ${k}`)
        .join("")}
    </p>
  );

  // Only the macros the owner tracks get a cell; the grid takes its column count from them.
  const trackedMacros = (["protein", "carbs", "fat"] as const).filter((k) => shows(k));
  const PREVIEW_COLS = ["grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"];

  const phonePreview = quantityError ? (
    <p className="text-sm text-destructive">{quantityError}</p>
  ) : (
    <div className={`grid divide-x divide-g2 border-y border-g2 tabular-nums ${PREVIEW_COLS[trackedMacros.length]}`}>
      <p className="py-3 pr-3">
        <span className="block text-[12px] text-g4">kcal</span>
        <span className="mt-0.5 block text-[22px] font-medium text-ink">{scaled("kcal") != null ? Math.round(scaled("kcal")!) : "?"}</span>
      </p>
      {trackedMacros.map((k) => (
        <p key={k} className="px-3 py-3">
          <span className="block text-[12px] text-g4 capitalize">{k}</span>
          <span className="mt-0.5 block text-[22px] font-medium" style={{ color: plateOf(k) }}>
            {scaled(k) != null ? Math.round(scaled(k)!) : "-"}
            <span className="text-[12px] text-g4"> g</span>
          </span>
        </p>
      ))}
    </div>
  );

  const blankWarning = activeFood && per100?.kcal == null && (
    <p className="border-y border-g2 py-2.5 text-[13px] text-g5">
      <span className="font-medium text-ink">No nutrition values yet.</span>{" "}
      {activeFood.barcode ? (
        <Link href={`/scanner?code=${encodeURIComponent(activeFood.barcode)}`} className="font-medium text-ink underline underline-offset-2">
          Add them from the package
        </Link>
      ) : (
        <Link href="/foods" className="font-medium text-ink underline underline-offset-2">Add them on the Foods page</Link>
      )}{" "}
      first, or this counts as 0 kcal.
    </p>
  );

  const unitPicker = activeFood && (
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
  );

  const loadingStep = detailError ? (
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
  );

  const barcodeArea = (
    <div className="space-y-3">
      {/* Remounts after each try, so "Scan another" is just showing it again */}
      {!barcodeLookup.isPending && <BarcodeCamera key={barcodeError} onCode={handleScanned} autoStart={!barcodeError} />}
      {barcodeLookup.isPending && (
        <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-border bg-muted/30 text-sm text-muted-foreground">
          Looking up {barcodeInput}...
        </div>
      )}
      <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
        <Input
          type="text"
          value={barcodeInput}
          onChange={(e) => { setBarcodeInput(e.target.value); setMissingBarcode(""); }}
          placeholder="Or type the number..."
          inputMode="numeric"
          className="flex-1 h-10 font-mono placeholder:font-sans"
        />
        <Button type="submit" disabled={!barcodeInput.trim() || barcodeLookup.isPending} size="lg" className="h-10">
          {barcodeLookup.isPending ? "..." : "Look up"}
        </Button>
      </form>
      {barcodeError && <p className="text-xs text-destructive">{barcodeError}</p>}
      {missingBarcode && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="lg" className="h-10" onClick={() => { setTab("search"); setBarcodeError(""); setMissingBarcode(""); }}>
            <Search className="h-4 w-4" aria-hidden="true" /> Search by name
          </Button>
          <Link href={`/foods?new=1&barcode=${encodeURIComponent(missingBarcode)}`}>
            <Button variant="ghost" size="lg" className="h-10">Add as new food</Button>
          </Link>
        </div>
      )}
    </div>
  );

  const searchResults = searching ? (
    [1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-muted/50 animate-pulse" />)
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
            isPhone ? "min-h-12" : ""
          } ${disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-muted/50"}`}
        >
          <div className="min-w-0">
            <p className="truncate text-foreground/90">
              {food.name}
              {food.id && logged[food.id]?.length ? <Check className="ml-1.5 inline h-3.5 w-3.5 text-primary" aria-label="logged" /> : null}
            </p>
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
                <span className="block text-[10px] text-muted-foreground">per 100 g</span>
              </span>
            ) : "--"}
          </span>
        </button>
      );
    })
  );

  const pager = !showRecents && searchPage && searchPage.pages > 1 && (
    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
      <Button variant="ghost" size="xs" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
      <span className="text-xs text-muted-foreground tabular-nums">{page} / {searchPage.pages}</span>
      <Button variant="ghost" size="xs" disabled={page === searchPage.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
    </div>
  );

  // Android back: one step back inside the sheet (amount, scanner, list), then close. The sheet
  // holds one history entry while open, so back never leaves the page under it.
  const backAction = useRef<() => void>(() => {});
  backAction.current = () => {
    if (step !== "browse") backToBrowse();
    else if (tab === "barcode") setTab("search");
    else handleOpenChange(false);
  };
  const stepDepth = step !== "browse" || tab === "barcode";
  useEffect(() => {
    if (!isPhone || !open) return;
    history.pushState({ nutripilotSheet: true }, "");
    const onPop = () => {
      const closing = !stepDepthRef.current;
      backAction.current();
      // Still open after stepping back: hold the page again for the next back.
      if (!closing) history.pushState({ nutripilotSheet: true }, "");
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Closed with X, Done or a tap outside: drop the entry the sheet added.
      if (history.state?.nutripilotSheet) history.back();
    };
  }, [isPhone, open]);
  const stepDepthRef = useRef(stepDepth);
  stepDepthRef.current = stepDepth;

  if (isPhone) {
    return (
      <PhoneSheet
        open={open}
        onOpenChange={handleOpenChange}
        title={step === "browse" ? "Log food" : activeFood?.name ?? "Log food"}
        subtitle={step === "quantity" && activeFood ? `${sourceLabel(activeFood.source, activeFood.is_mine)}${!inGrams ? `, ${Math.round(grams * 10) / 10} g` : ""}` : undefined}
        onBack={step === "browse" ? (tab === "barcode" ? () => setTab("search") : undefined) : backToBrowse}
      >
        {/* Where it goes: meal and day, shared by every food logged from the sheet */}
        <LogTarget meal={mealType} onMeal={chooseMeal} date={date} onDate={setDate} />

        {step === "browse" && tab === "search" && (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2 thin-scrollbar">
              {showRecents ? (
                <>
                  <h3 className="pt-2 pb-1 text-[13px] text-g4">Recent</h3>
                  {recents!.map((food) => (
                    <RecentRow
                      key={food.id}
                      food={food}
                      count={logged[food.id]?.length ?? 0}
                      pending={quickPending === food.id}
                      onOpen={() => pick(food)}
                      onQuickLog={() => quickLog(food)}
                      onUndo={() => undoLog(food.id, logged[food.id]!.at(-1)!)}
                    />
                  ))}
                </>
              ) : query.trim() === "" ? (
                <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                  Search for a food below, or scan its barcode.
                </p>
              ) : (
                <>
                  {searchResults}
                  {pager}
                </>
              )}
            </div>

            {/* Thumb zone: Done bar after the first log, then the search bar with the camera */}
            <div className="space-y-2 border-t border-g2 bg-g1 px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {loggedCount > 0 && (
                <Button onClick={() => handleOpenChange(false)} size="lg" className="h-12 w-full rounded-full bg-ink text-g0 hover:bg-ink/90">
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {loggedCount} logged · Done
                </Button>
              )}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    type="text"
                    enterKeyHint="search"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                    placeholder="Search foods"
                    aria-label="Search foods"
                    className="h-12 rounded-full border-g3 bg-g0 pl-10 text-base"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => { setQuery(""); setPage(1); }}
                      aria-label="Clear search"
                      className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-muted-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setTab("barcode")}
                  aria-label="Scan a barcode"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-g3 text-ink transition-colors hover:border-g5"
                >
                  <ScanBarcode className="h-5 w-5" />
                </button>
              </div>
            </div>
          </>
        )}

        {step === "browse" && tab === "barcode" && (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{barcodeArea}</div>
        )}

        {step === "loading" && <div className="px-4">{loadingStep}</div>}

        {step === "quantity" && activeFood && (
          <>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 pb-3 thin-scrollbar">
              {unitPicker}
              {blankWarning}
              <div className="space-y-1.5">
                <Label htmlFor="log-amount" className="text-xs text-muted-foreground">
                  {inGrams ? "Grams" : unit.key === "serving" ? "Servings" : `Amount (${unit.label})`}
                </Label>
                <Input
                  id="log-amount"
                  type="number"
                  autoFocus
                  value={quantityValue}
                  onChange={(e) => setQuantityValue(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  min={bounds.min}
                  max={bounds.max}
                  step={inGrams ? 1 : 0.25}
                  inputMode="decimal"
                  aria-invalid={!!quantityError}
                  className="h-20 rounded-none border-0 border-b border-g3 bg-transparent px-0 text-[4rem] leading-none font-bold tracking-[-0.04em] tabular-nums shadow-none focus-visible:border-ink focus-visible:ring-0 dark:bg-transparent"
                />
              </div>
              <div className="space-y-1.5">
                {phonePreview}
              </div>
            </div>
            <div className="border-t border-g2 bg-g1 px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <Button onClick={handleSubmit} disabled={!!quantityError || logFood.isPending} size="lg" className="h-12 w-full rounded-full bg-ink text-g0 hover:bg-ink/90">
                {logFood.isPending ? "Logging..." : `Log to ${MEAL_TYPE_LABELS[mealType].toLowerCase()}`}
              </Button>
            </div>
          </>
        )}
      </PhoneSheet>
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
                ) : (
                  searchResults
                )}
              </div>
              {pager}
            </TabsContent>

            <TabsContent value="barcode" className="mt-3">
              {barcodeArea}
            </TabsContent>
          </Tabs>
        )}

        {step === "loading" && loadingStep}

        {step === "quantity" && activeFood && (
          <div className="space-y-4 overflow-y-auto thin-scrollbar">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">{sourceLabel(activeFood.source, activeFood.is_mine)}</Badge>
            </div>

            {unitPicker}
            {blankWarning}

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
              {preview}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Meal</Label>
                <select
                  value={mealType}
                  onChange={(e) => chooseMeal(e.target.value as MealType)}
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

/** Full height bottom sheet for phones, on the same dialog primitive (focus trap, Escape, back). */
function PhoneSheet({
  open, onOpenChange, title, subtitle, onBack, children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  // Dragging the handle down past a third of the sheet closes it.
  const startY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
        className="top-auto bottom-0 left-0 flex h-[92dvh] w-full max-w-full translate-x-0 translate-y-0 flex-col gap-0 rounded-t-3xl rounded-b-none p-0 sm:max-w-full data-open:zoom-in-100 data-open:slide-in-from-bottom data-closed:zoom-out-100 data-closed:slide-out-to-bottom motion-reduce:animate-none"
      >
        <div
          className="flex shrink-0 touch-none justify-center pt-2.5 pb-1"
          onPointerDown={(e) => { startY.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (startY.current != null) setDragY(Math.max(0, e.clientY - startY.current)); }}
          onPointerUp={(e) => {
            const closing = startY.current != null && e.clientY - startY.current > window.innerHeight * 0.3;
            startY.current = null;
            setDragY(0);
            if (closing) onOpenChange(false);
          }}
          aria-hidden="true"
        >
          <span className="h-1.5 w-10 rounded-full bg-muted-foreground/40" />
        </div>
        <div className="flex shrink-0 items-center gap-1 px-2 pb-1">
          {onBack ? (
            <button type="button" onClick={onBack} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50">
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <span className="w-2" />
          )}
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-base">{title}</DialogTitle>
            {subtitle && <p className="truncate text-[12px] text-g4">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** "Log to [Lunch] [Today]": chips that open the native pickers. */
function LogTarget({ meal, onMeal, date, onDate }: {
  meal: MealType;
  onMeal: (meal: MealType) => void;
  date: string;
  onDate: (date: string) => void;
}) {
  const chip = "relative flex h-11 items-center gap-1.5 rounded-full border border-g3 px-4 text-[13px] font-medium text-ink focus-within:outline-2 focus-within:outline-ink";
  const day = dayName(date);
  return (
    <div className="flex shrink-0 items-center gap-2 px-5 pb-3">
      <span className="text-[13px] text-g4">Log to</span>
      <label className={chip}>
        {MEAL_TYPE_LABELS[meal]}
        <svg className="h-3 w-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        <select
          value={meal}
          onChange={(e) => onMeal(e.target.value as MealType)}
          aria-label="Meal"
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {MEAL_TYPES.map((mt) => <option key={mt} value={mt}>{MEAL_TYPE_LABELS[mt]}</option>)}
        </select>
      </label>
      <label className={chip}>
        {day.charAt(0).toUpperCase() + day.slice(1)}
        <svg className="h-3 w-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && onDate(e.target.value)}
          aria-label="Day"
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}

/** A recent food: tap the row to choose an amount, tap + to log last time's amount at once. */
function RecentRow({ food, count, pending, onOpen, onQuickLog, onUndo }: {
  food: RecentFood;
  count: number;
  pending: boolean;
  onOpen: () => void;
  onQuickLog: () => void;
  /** Tapping the tick takes the latest log of this food back (after the toast is gone too). */
  onUndo: () => void;
}) {
  const kcal = food.kcal != null ? Math.round((food.kcal * food.last_quantity_g) / 100) : null;
  const portion = formatPortion(food.last_amount, food.last_unit, food.last_quantity_g, food.last_unit_label);
  return (
    <div className="flex items-center gap-2 border-t border-g2">
      <button type="button" onClick={onOpen} className="flex min-h-[3.75rem] min-w-0 flex-1 items-center py-2 text-left">
        <span className="min-w-0">
          <span className={`flex items-center gap-2 truncate text-[16px] ${count ? "text-ink" : "text-ink/90"}`}>
            {count > 0 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink" aria-hidden="true" />}
            <span className="truncate">{food.name}</span>
          </span>
          <span className="mt-0.5 block truncate text-[12px] tabular-nums text-g4">
            {portion}{kcal != null ? `, ${kcal} kcal` : ""}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={count ? onUndo : onQuickLog}
        disabled={pending}
        aria-label={count ? `Logged ${food.name}. Undo` : `Log ${food.name}, ${portion}`}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-60 ${
          count ? "bg-ink text-g0" : "border border-g3 text-ink hover:border-g5"
        }`}
      >
        {pending ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : count ? (
          count > 1 ? <span className="text-xs font-semibold tabular-nums">{count}×</span> : <Check className="h-5 w-5" />
        ) : (
          <Plus className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}
