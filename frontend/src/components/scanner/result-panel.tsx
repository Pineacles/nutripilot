import { useState } from "react";
import { atwaterMismatch } from "@/lib/portion";
import { BARCODE_PROBLEM_TEXT, barcodeProblem } from "@/lib/barcode";
import { sourceLabel } from "@/lib/format";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { LogFoodForm } from "./log-food-form";
import { useCorrectFoodByBarcode } from "@/hooks/mutations/food-correction";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import { useTracked } from "@/hooks/use-tracked";
import { plateOf } from "@/lib/plates";
import type { FoodDetail } from "@/lib/types";

type ErrorType = "not-found" | "network" | "camera" | null;

// A nutrient's number wears its plate ink (plateOf); kcal, sugar, salt stay ink.
const NUTRIENT_CONFIG: Record<string, { label: string; unit: string; primary: boolean }> = {
  kcal:    { label: "Calories", unit: "kcal", primary: true },
  protein: { label: "Protein",  unit: "g",    primary: true },
  carbs:   { label: "Carbs",    unit: "g",    primary: true },
  fat:     { label: "Fat",      unit: "g",    primary: true },
  fiber:   { label: "Fiber",    unit: "g",    primary: false },
  sugar:   { label: "Sugar",    unit: "g",    primary: false },
  sat_fat: { label: "Saturated fat", unit: "g", primary: false },
  salt:    { label: "Salt",     unit: "g",    primary: false },
};

interface Props {
  loading: boolean;
  result: FoodDetail | null;
  error: string;
  errorType: ErrorType;
  scannedCode: string;
  onRetryLookup: () => void;
  onScanAnother: () => void;
  onCorrected: (food: FoodDetail) => void;
  // log-food-form passthrough
  loggedOn: string | null;
  onLog: () => void;
}

export function ResultPanel({
  loading, result, error, errorType, scannedCode, onRetryLookup, onScanAnother, onCorrected,
  loggedOn, onLog,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editServingSize, setEditServingSize] = useState("");
  const [editServingLabel, setEditServingLabel] = useState("");
  const [editNutrients, setEditNutrients] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const correctFood = useCorrectFoodByBarcode();
  const { shows } = useTracked();
  const problem = scannedCode ? barcodeProblem(scannedCode) : null;
  // Open Food Facts often knows a product before anyone has typed in its label.
  const blank = !!result && result.nutrients?.kcal == null;
  const [promptedFor, setPromptedFor] = useState<string | null>(null);

  const startEdit = () => {
    if (!result) return;
    setEditServingSize(result.serving_size_g != null ? String(result.serving_size_g) : "");
    setEditServingLabel(result.serving_label || "");
    const n: Record<string, string> = {};
    let hasNonPrimary = false;
    if (result.nutrients) {
      for (const key of Object.keys(NUTRIENT_CONFIG)) {
        const val = result.nutrients[key];
        n[key] = val != null ? String(val) : "";
        if (!NUTRIENT_CONFIG[key].primary && val != null) {
          hasNonPrimary = true;
        }
      }
    }
    setEditNutrients(n);
    setShowAdvanced(hasNonPrimary);
    setIsEditing(true);
  };

  // A blank product opens the edit form straight away, once per scan.
  if (result && blank && !isEditing && promptedFor !== result.id) {
    setPromptedFor(result.id);
    startEdit();
  }

  const cancelEdit = () => {
    setIsEditing(false);
  };

  const saveEdit = () => {
    if (!result) return;
    const body: Record<string, unknown> = {};
    if (editServingSize !== "" && Number(editServingSize) !== result.serving_size_g) {
      body.serving_size_g = Number(editServingSize);
    }
    if (editServingLabel !== (result.serving_label || "")) body.serving_label = editServingLabel;
    
    const nutrients: Record<string, number> = {};
    for (const key of Object.keys(NUTRIENT_CONFIG)) {
      const newVal = editNutrients[key];
      const oldVal = result.nutrients?.[key];
      if (newVal !== "" && Number(newVal) !== oldVal) {
        nutrients[key] = Number(newVal);
      }
    }
    if (Object.keys(nutrients).length > 0) body.nutrients = nutrients;

    if (Object.keys(body).length === 0) {
      setIsEditing(false);
      return;
    }

    correctFood.mutate(
      { barcode: result.barcode || scannedCode, body },
      {
        onSuccess: (updated) => {
          toast.success(blank ? "Values saved" : "Values corrected");
          onCorrected(updated);
          setIsEditing(false);
        },
        onError: (err) => {
          toast.error(getErrorMessage(err));
        }
      }
    );
  };

  // Shown for one serving when the pack names one (what people compare on the label), else 100 g.
  const getDisplayGrams = (): number => result?.serving_size_g || 100;

  const kcalEstimate = result?.nutrients ? atwaterMismatch(result.nutrients) : null;
  const displayGrams = getDisplayGrams();
  const scaleFactor = displayGrams / 100;

  const formatScaled = (val: number | undefined | null) => {
    if (val == null) return null;
    return Math.round(val * scaleFactor * 10) / 10;
  };

  const gramsStr = `${Math.round(displayGrams * 10) / 10} g`;
  const footerText = result?.serving_size_g
    ? `Per serving, ${result.serving_label || gramsStr}${result.serving_label ? ` (${gramsStr})` : ""}`
    : `Per ${gramsStr}`;

  // Only tracked nutrients show (calories always do); grids recompute their columns from what is left.
  const primaryKeys = Object.keys(NUTRIENT_CONFIG).filter((k) => NUTRIENT_CONFIG[k].primary && shows(k));
  const secondaryKeys = Object.keys(NUTRIENT_CONFIG).filter((k) => !NUTRIENT_CONFIG[k].primary && shows(k));
  const primaryShown = primaryKeys.filter((k) => result?.nutrients?.[k] != null);
  const secondaryShown = secondaryKeys.filter((k) => result?.nutrients?.[k] != null);

  const editField = (key: string) => {
    const cfg = NUTRIENT_CONFIG[key];
    return (
      <div key={key} className="space-y-1.5">
        <Label htmlFor={`scan-${key}`}>{cfg.label} · {cfg.unit}/100g</Label>
        <Input
          id={`scan-${key}`}
          type="number"
          inputMode="decimal"
          value={editNutrients[key] || ""}
          onChange={(e) => setEditNutrients((prev) => ({ ...prev, [key]: e.target.value }))}
          className="tabular-nums"
        />
      </div>
    );
  };

  return (
    <div className="clay-card p-5">
      <h3 className="mb-3 text-[15px] leading-6 font-medium text-ink">Result</h3>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3 py-2" aria-busy="true">
          <div className="h-6 w-3/4 rounded bg-g2 animate-pulse motion-reduce:animate-none" />
          <div className="h-4 w-1/2 rounded bg-g2 animate-pulse motion-reduce:animate-none" />
          <div className="mt-4 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-5 rounded bg-g2 animate-pulse motion-reduce:animate-none" />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !result && !error && (
        <div className="flex h-32 flex-col items-center justify-center border-t border-g2 text-center">
          <p className="text-[13px] text-g4">Scan a barcode or enter one manually</p>
        </div>
      )}

      {/* Not found error: a shop's counter label and a misread scan get their own advice */}
      {!loading && errorType === "not-found" && (
        <div role="alert" className="space-y-3 border-t border-g2 pt-4">
          <div>
            <p className="text-[15px] font-medium text-ink">
              {problem === "store_label" ? "Shop label, not a product code" : problem === "misread" ? "Scan misread" : "Barcode not found"}
            </p>
            <p className="mt-1 text-[13px] text-g4">
              <span className="font-mono text-g5">{scannedCode}</span>
              {problem ? null : " is not in our database."}
            </p>
            <p className="mt-1 text-[13px] text-g4">
              {problem ? BARCODE_PROBLEM_TEXT[problem] : "Add it from the package label, or search by name instead."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!problem && (
              <Link href={`/foods?new=1&barcode=${encodeURIComponent(scannedCode)}`}>
                <Button size="sm">Add as new food</Button>
              </Link>
            )}
            <Link href="/foods">
              <Button variant="outline" size="sm">Browse foods</Button>
            </Link>
            <Button onClick={onScanAnother} variant="ghost" size="sm">
              Scan another
            </Button>
          </div>
        </div>
      )}

      {/* Network error */}
      {!loading && errorType === "network" && (
        <div role="alert" className="space-y-3 border-t border-g2 pt-4">
          <div>
            <p className="text-[15px] font-medium text-ink">Connection error</p>
            <p className="mt-1 text-[13px] text-g4">{error}</p>
          </div>
          <Button onClick={onRetryLookup} variant="outline" size="sm">
            Retry
          </Button>
        </div>
      )}

      {/* Success result */}
      {!loading && result && (
        <div className="space-y-4">
          {/* The product */}
          <div className="flex items-start justify-between gap-3 border-t border-g2 pt-4">
            <div className="min-w-0 flex-1">
              <h4 className="truncate text-[17px] leading-snug font-medium text-ink">{result.name}</h4>
              {result.barcode && <span className="font-mono text-xs text-g4">{result.barcode}</span>}
            </div>
            <Badge variant="outline">{sourceLabel(result.source, result.is_mine)}</Badge>
          </div>

          {!isEditing && kcalEstimate != null && (
            <p className="border-t border-g2 pt-3 text-[13px] text-g5">
              <span className="font-medium text-ink">Check these values. </span>
              Protein, carbs and fat add up to about {kcalEstimate} kcal per 100 g, not{" "}
              {Math.round(result.nutrients?.kcal ?? 0)}. Compare with the package and edit them if needed.
            </p>
          )}

          {/* Edit Mode Controls */}
          {isEditing ? (
            <div className="space-y-4">
              {blank ? (
                <div className="border-t border-g2 pt-3">
                  <p className="text-[15px] font-medium text-ink">No nutrition values yet</p>
                  <p className="mt-1 text-[13px] text-g4">
                    The product is known but nobody has added its label. Copy the per 100 g column from the
                    package, and the pack size as the serving. Saved values are used every time it is scanned.
                  </p>
                </div>
              ) : (
                <p className="border-t border-g2 pt-3 text-[15px] font-medium text-ink">Edit values · per 100 g</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="scan-serving-size">Serving size (g)</Label>
                  <Input
                    id="scan-serving-size"
                    type="number"
                    inputMode="decimal"
                    value={editServingSize}
                    onChange={(e) => setEditServingSize(e.target.value)}
                    className="tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="scan-serving-label">Serving label</Label>
                  <Input
                    id="scan-serving-label"
                    type="text"
                    value={editServingLabel}
                    onChange={(e) => setEditServingLabel(e.target.value)}
                  />
                </div>
              </div>

              <div className={`grid gap-3 border-t border-g2 pt-4 ${primaryKeys.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                {primaryKeys.map(editField)}
              </div>

              {secondaryKeys.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    aria-expanded={showAdvanced}
                    className="flex min-h-11 w-full items-center justify-between border-t border-g2 text-[13px] text-g5 transition-colors hover:text-ink"
                  >
                    More nutrients
                    <svg
                      className={`h-4 w-4 transition-transform duration-[var(--dur-fast)] motion-reduce:transition-none ${showAdvanced ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  {showAdvanced && (
                    <div className="grid grid-cols-2 gap-3">{secondaryKeys.map(editField)}</div>
                  )}
                </>
              )}

              <div className="sticky bottom-2 flex gap-2 border-t border-g2 bg-g1 pt-3 md:bg-g1">
                <Button onClick={cancelEdit} variant="ghost" size="lg">
                  Cancel
                </Button>
                <Button onClick={saveEdit} size="lg" className="flex-1" disabled={correctFood.isPending}>
                  {correctFood.isPending ? "Saving..." : blank ? "Save values" : "Save corrections"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {blank ? (
                <div className="flex items-center justify-between gap-3 border-t border-g2 pt-3">
                  <p className="text-[13px] text-g4">No nutrition values yet. Add them from the package to log this food.</p>
                  <Button size="sm" className="shrink-0" onClick={startEdit}>Add values</Button>
                </div>
              ) : result.nutrients ? (
                <div>
                  {/* Calories and the tracked macros: one equal-fraction row */}
                  {primaryShown.length > 0 && (
                    <div
                      className="grid border-y border-g2"
                      style={{ gridTemplateColumns: `repeat(${primaryShown.length}, minmax(0, 1fr))` }}
                    >
                      {primaryShown.map((key, i) => {
                        const cfg = NUTRIENT_CONFIG[key];
                        return (
                          <div key={key} className={`py-3 ${i > 0 ? "border-l border-g2 pl-3" : ""}`}>
                            <p className="text-xs text-g4">{cfg.label}</p>
                            <p
                              className="text-[22px] leading-tight font-medium tabular-nums text-ink"
                              style={{ color: plateOf(key) }}
                            >
                              {formatScaled(result.nutrients?.[key])}
                              <span className="ml-0.5 text-xs font-normal text-g4">{cfg.unit}</span>
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Other tracked nutrients: ruled rows, values right-aligned */}
                  {secondaryShown.length > 0 && (
                    <dl>
                      {secondaryShown.map((key) => {
                        const cfg = NUTRIENT_CONFIG[key];
                        return (
                          <div key={key} className="flex min-h-12 items-center justify-between border-b border-g2">
                            <dt className="text-[15px] text-ink">{cfg.label}</dt>
                            <dd className="text-[15px] tabular-nums text-g5" style={{ color: key === "fiber" ? plateOf(key) : undefined }}>
                              {formatScaled(result.nutrients?.[key])}
                              <span className="ml-0.5 text-xs text-g4">{cfg.unit}</span>
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  )}

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-xs text-g4">{footerText}</p>
                    <Button variant="outline" size="sm" onClick={startEdit}>
                      Edit values
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-g4">No nutrient data available</p>
              )}
            </>
          )}

          {/* Log this: not before it has values, or it would count as 0 kcal */}
          {!blank && !isEditing && <LogFoodForm result={result} loggedOn={loggedOn} onLog={onLog} />}

          {/* Action buttons */}
          <div className="flex justify-end gap-2">
            <Button onClick={onScanAnother} variant="outline" size="sm">
              Scan another
            </Button>
            <Link href="/foods">
              <Button variant="ghost" size="sm">
                Browse foods
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
