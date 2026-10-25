"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNutrientSources } from "@/hooks/queries";
import { getErrorMessage } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { plateOf } from "@/lib/plates";

export interface SourcesTarget {
  /** API key of the nutrient ("protein", "sodium"). */
  key: string;
  label: string;
  unit: string;
  ink?: string;
}

/** Which foods made up a nutrient on one day, largest first. */
export function NutrientSourcesDialog({ target, date, onClose }: { target: SourcesTarget | null; date: string; onClose: () => void }) {
  const { data, isFetching, isError, error } = useNutrientSources(target?.key ?? null, date, date);
  const sources = data?.sources ?? [];
  const total = data?.total ?? 0;
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[80vh] max-w-md flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-lg">Where the {target?.label.toLowerCase()} came from</DialogTitle>
          <p className="text-sm text-g4">
            <span className="font-semibold tabular-nums text-ink">{fmt(total)} {target?.unit}</span> in total
          </p>
        </DialogHeader>
        <div className="thin-scrollbar -mx-1 flex-1 overflow-y-auto px-1">
          {isError ? (
            <p className="py-8 text-center text-sm text-g4">{getErrorMessage(error, "Couldn't load the sources for this day.")}</p>
          ) : isFetching ? (
            <div className="divide-y divide-g2">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 animate-pulse bg-g1/60" />)}
            </div>
          ) : sources.length === 0 ? (
            <p className="py-8 text-center text-sm text-g4">Nothing logged with {target?.label.toLowerCase()} on this day.</p>
          ) : (
            <ul className="divide-y divide-g2 border-y border-g2">
              {sources.map((s, i) => {
                const pct = total > 0 ? (s.amount / total) * 100 : 0;
                return (
                  <li key={i} className="py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-[15px] text-ink">{s.food_name}</span>
                      <span className="shrink-0 text-[15px] font-medium tabular-nums text-ink">
                        {fmt(s.amount)} {target?.unit}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-[3px] flex-1 bg-g2">
                        <div className="animate-bar h-full" style={{ width: `${pct}%`, background: target?.ink ?? plateOf(target?.key ?? "") }} />
                      </div>
                      <span className="w-12 text-right text-[12px] tabular-nums text-g4">{Math.round(pct)}%</span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-g4">
                      {s.meal_type}, {fmt(s.quantity_g, 0)} g
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
