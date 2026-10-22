"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFoodsSearch, useFoodDetail } from "@/hooks/queries";
import { useDeleteFood, useCloneFood } from "@/hooks/mutations/foods";
import { FoodForm } from "@/components/foods/food-form";
import { AddFoodDialog } from "@/components/food-log/add-food-dialog";
import { useMediaQuery } from "@/hooks/use-media-query";
import { getErrorMessage, ApiError } from "@/lib/api";
import { sourceLabel } from "@/lib/format";
import { todayStr } from "@/lib/dates";
import { NUTRIENT_LABELS } from "@/lib/nutrient-labels";
import type { FoodDetail } from "@/lib/types";

export default function FoodsPage() {
  return (
    <Suspense>
      <FoodsPageInner />
    </Suspense>
  );
}

function FoodsPageInner() {
  // /foods?new=1&barcode=... comes from a scan that found nothing: open "Add food" with the barcode filled in.
  const searchParams = useSearchParams();
  const [prefillBarcode] = useState(() => searchParams.get("barcode") ?? "");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(() => searchParams.get("new") === "1");
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formInitial, setFormInitial] = useState<FoodDetail | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  // Below lg the detail panel would stack under the list, so it opens as a dialog instead.
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  // Debounce the search box so we don't hit the API on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const {
    data,
    isFetching: loading,
    isError,
    error,
    refetch,
  } = useFoodsSearch(debouncedQuery, page, 20);

  const { data: detail } = useFoodDetail(selectedId);
  const deleteFood = useDeleteFood();
  const cloneFood = useCloneFood();

  function selectFood(id: string | null) {
    if (!id) return;
    setConfirmingDelete(false);
    setSelectedId((prev) => (prev === id ? null : id));
  }

  function openCreate() {
    setFormMode("create");
    setFormInitial(null);
    setFormOpen(true);
  }

  function openEdit(food: FoodDetail) {
    setFormMode("edit");
    setFormInitial(food);
    setFormOpen(true);
  }

  function handleFormSuccess(food: FoodDetail) {
    setFormOpen(false);
    setSelectedId(food.id);
  }

  function handleDelete(id: string) {
    deleteFood.mutate(id, {
      onSuccess: () => {
        toast.success("Food deleted");
        setSelectedId(null);
        setConfirmingDelete(false);
      },
      onError: (err) => {
        if (err instanceof ApiError && err.status === 409) {
          toast.error("Can't delete: this food is used in logs");
        } else {
          toast.error(getErrorMessage(err, "Couldn't delete food."));
        }
        setConfirmingDelete(false);
      },
    });
  }

  function handleClone(food: FoodDetail) {
    cloneFood.mutate(
      { id: food.id },
      {
        onSuccess: (cloned) => {
          toast.success("Cloned, now editable");
          setSelectedId(cloned.id);
          openEdit(cloned);
        },
      }
    );
  }

  const detailBody = (
    <>
          {!detail ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <svg className="h-10 w-10 text-muted-foreground/30 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm text-muted-foreground">Select a food to see nutrients</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-base font-semibold text-foreground">{detail.name}</h4>
                {detail.is_mine && <Badge className="text-[10px]">My food</Badge>}
              </div>
              {detail.barcode && (
                <p className="text-xs text-muted-foreground mb-3 font-mono">{detail.barcode}</p>
              )}
              {detail.serving_size_g && (
                <p className="text-xs text-muted-foreground mb-2">
                  {detail.serving_label || "1 serving"} = {detail.serving_size_g}g
                </p>
              )}
              {detail.nutrients ? (
                <div className="space-y-2">
                  {Object.entries(NUTRIENT_LABELS).map(([key, meta]) => {
                    const val = detail.nutrients?.[key];
                    if (val == null) return null;
                    return (
                      <div key={key} className="flex items-center justify-between py-0.5">
                        <span className="text-xs text-muted-foreground">{meta.label}</span>
                        <span className="text-xs tabular-nums text-foreground font-medium">
                          {Math.round(val * 10) / 10} {meta.unit}
                        </span>
                      </div>
                    );
                  })}
                  <Separator className="my-2" />
                  <p className="text-[9px] text-muted-foreground/50">
                    Values per 100 g, from {sourceLabel(detail.source, detail.is_mine)}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No nutrient data available</p>
              )}

              <Separator className="my-3" />
              <Button onClick={() => setLogOpen(true)} className="mb-2 h-10 w-full" size="lg">Log food</Button>
              {detail.editable ? (
                !confirmingDelete ? (
                  <div className="flex gap-2">
                    <Button onClick={() => openEdit(detail)} variant="outline" size="lg" className="h-10 flex-1">Edit</Button>
                    <Button onClick={() => setConfirmingDelete(true)} variant="destructive" size="lg" className="h-10 flex-1">Delete</Button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 space-y-2">
                    <p className="text-xs text-destructive/80">Delete this food permanently?</p>
                    <div className="flex gap-2">
                      <Button onClick={() => handleDelete(detail.id)} disabled={deleteFood.isPending} variant="destructive" size="sm" className="flex-1">
                        {deleteFood.isPending ? "Deleting..." : "Confirm"}
                      </Button>
                      <Button onClick={() => setConfirmingDelete(false)} variant="outline" size="sm" className="flex-1">Cancel</Button>
                    </div>
                  </div>
                )
              ) : (
                <Button onClick={() => handleClone(detail)} disabled={cloneFood.isPending} variant="outline" size="sm" className="w-full">
                  {cloneFood.isPending ? "Cloning..." : "Clone & customize"}
                </Button>
              )}
            </div>
          )}
    </>
  );

  return (
    <DashboardLayout title="Food Database">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Food list (2 cols) */}
        <div className="clay-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Foods</h3>
            <Button onClick={openCreate} size="sm">+ Add food</Button>
          </div>
          <div className="mb-3">
            <Input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search foods..."
              className="h-10"
            />
          </div>

          {isError ? (
            <ErrorState message={getErrorMessage(error, "Couldn't load foods.")} onRetry={() => refetch()} />
          ) : loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <EmptyState message="No foods found" actionLabel="+ Add food" onAction={openCreate} />
          ) : (
            <>
              <div className="space-y-1">
                {/* Header */}
                <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                  <span className="col-span-5">Name</span>
                  <span className="col-span-2">Source</span>
                  <span className="col-span-2 text-right">Kcal</span>
                  <span className="col-span-2 text-right">Protein</span>
                  <span className="col-span-1"></span>
                </div>
                {data.items.map((food) => (
                  <button
                    key={food.id ?? food.name}
                    onClick={() => selectFood(food.id)}
                    className={`grid grid-cols-12 gap-x-2 gap-y-0.5 w-full min-h-10 items-center rounded-lg px-3 py-2 text-sm text-left transition-all duration-150 ${
                      selectedId === food.id ? "bg-primary/10 clay-card-sm" : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="col-span-12 sm:col-span-5 text-foreground/80 truncate">{food.name}</span>
                    <span className="col-span-12 text-xs text-muted-foreground tabular-nums sm:hidden">
                      {food.kcal != null ? `${Math.round(food.kcal)} kcal` : "-- kcal"}
                      {" · "}
                      {food.protein != null ? `${Math.round(food.protein)}g protein` : "-- protein"}
                    </span>
                    <span className="hidden sm:block col-span-2 text-xs text-muted-foreground">{sourceLabel(food.source)}</span>
                    <span className="hidden sm:block col-span-2 text-right tabular-nums text-foreground/60">
                      {food.kcal != null ? Math.round(food.kcal) : "--"}
                    </span>
                    <span className="hidden sm:block col-span-2 text-right tabular-nums text-foreground/60">
                      {food.protein != null ? `${Math.round(food.protein)}g` : "--"}
                    </span>
                    <span className="hidden sm:block col-span-1 text-right">
                      <svg className={`h-3.5 w-3.5 text-muted-foreground/40 inline transition-transform duration-150 ${selectedId === food.id ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </button>
                ))}
              </div>

              {/* Pagination */}
              {data.pages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">{data.total} foods total</span>
                  <div className="flex gap-1">
                    <Button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      variant="ghost"
                      size="xs"
                      className="h-10 px-3"
                    >
                      Prev
                    </Button>
                    <span className="flex items-center px-2 text-xs text-muted-foreground tabular-nums">
                      {page} / {data.pages}
                    </span>
                    <Button
                      onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                      disabled={page === data.pages}
                      variant="ghost"
                      size="xs"
                      className="h-10 px-3"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Nutrient detail (1 col) */}
        <div className="clay-card p-5 lg:col-span-1 hidden lg:block">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Nutrient Breakdown</h3>
          {detailBody}
        </div>
      </div>

      <Dialog
        open={!isDesktop && !!selectedId && !formOpen && !logOpen}
        onOpenChange={(next) => { if (!next) { setSelectedId(null); setConfirmingDelete(false); } }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nutrient breakdown</DialogTitle>
          </DialogHeader>
          {detailBody}
        </DialogContent>
      </Dialog>

      {detail && (
        <AddFoodDialog
          open={logOpen}
          onOpenChange={setLogOpen}
          defaultDate={todayStr()}
          initialFoodId={detail.id}
        />
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{formMode === "edit" ? "Edit food" : "Add food"}</DialogTitle>
          </DialogHeader>
          <FoodForm
            key={formInitial?.id ?? "new"}
            mode={formMode}
            initial={formInitial}
            defaultBarcode={formMode === "create" ? prefillBarcode : undefined}
            onSuccess={handleFormSuccess}
            onCancel={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
