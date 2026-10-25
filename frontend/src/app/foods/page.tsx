"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard-layout";
import Link from "next/link";
import { SettingsLink } from "@/components/settings-link";
import { Plus, ScanBarcode, Search, X } from "lucide-react";
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
import { MACRO_NUTRIENT_LABELS, MICRO_NUTRIENT_LABELS, NUTRIENT_LABELS } from "@/lib/nutrient-labels";
import { useTracked } from "@/hooks/use-tracked";
import { plateOf } from "@/lib/plates";
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
  const { shows } = useTracked();
  const showProtein = shows("protein");

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

  const pillOutline =
    "inline-flex h-11 items-center justify-center rounded-full border border-g3 px-5 text-[13px] font-medium text-ink transition-colors hover:border-g5 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:text-g3 disabled:hover:border-g3";
  const pillInk =
    "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-[15px] font-medium text-g0 transition-transform active:scale-[0.98] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:bg-g3 disabled:text-g5";

  // Only the nutrients the owner tracks; kcal is always there. Vitamins and minerals get their own block.
  const macroKeys = Object.keys(MACRO_NUTRIENT_LABELS);
  const detailRows = (keys: string[]) =>
    keys
      .map((key) => ({ key, meta: NUTRIENT_LABELS[key], val: detail?.nutrients?.[key] }))
      .filter((r) => r.val != null && (r.key === "kcal" || shows(r.key)));
  const macroRows = detailRows(macroKeys);
  const microRows = detailRows(Object.keys(MICRO_NUTRIENT_LABELS));
  const plate = (key: string) => plateOf(key);
  const nutrientRows = (rows: typeof macroRows) => (
    <ul className="divide-y divide-g2 border-y border-g2">
      {rows.map(({ key, meta, val }) => (
        <li key={key} className="flex min-h-11 items-center justify-between gap-3 text-[15px]">
          <span className="text-g4">{meta.label}</span>
          <span className="tabular-nums text-ink" style={{ color: plate(key) }}>
            {Math.round((val as number) * 10) / 10} <span className="text-[12px] text-g4">{meta.unit}</span>
          </span>
        </li>
      ))}
    </ul>
  );

  const detailBody = (
    <>
      {!detail ? (
        <p className="py-6 text-[15px] text-g4">Pick a food from the list to see what is in 100 g of it.</p>
      ) : (
        <div>
          <h4 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink">{detail.name}</h4>
          <p className="mt-1 text-[12px] text-g4">
            {sourceLabel(detail.source, detail.is_mine)}
            {detail.is_mine && " · yours"}
            {detail.barcode && <span className="font-mono"> · {detail.barcode}</span>}
          </p>
          {detail.nutrients ? (
            <div className="mt-5">
              <p className="mb-1 text-[12px] text-g4">Values per 100 g</p>
              {nutrientRows(macroRows)}
              {microRows.length > 0 && (
                <>
                  <p className="mb-1 mt-5 text-[12px] text-g4">Vitamins and minerals per 100 g</p>
                  {nutrientRows(microRows)}
                </>
              )}
              {detail.serving_size_g && (
                <p className="mt-3 text-[12px] text-g4">
                  {detail.serving_label || "1 serving"} = {detail.serving_size_g} g. The values above are not per serving.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-4 text-[15px] text-g4">No nutrient values yet. Edit the food to add them.</p>
          )}

          <div className="mt-6 space-y-2">
            <button onClick={() => setLogOpen(true)} className={`${pillInk} w-full`}>Log food</button>
            {detail.editable ? (
              !confirmingDelete ? (
                <div className="flex gap-2">
                  <button onClick={() => openEdit(detail)} className={`${pillOutline} flex-1`}>Edit</button>
                  <button onClick={() => setConfirmingDelete(true)} className={`${pillOutline} flex-1`}>Delete</button>
                </div>
              ) : (
                <div className="border-y border-g2 py-3">
                  <p className="text-[15px] text-ink">Delete this food for good?</p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => handleDelete(detail.id)} disabled={deleteFood.isPending} className={`${pillOutline} flex-1 !border-alert !text-alert hover:bg-alert/12 disabled:!border-g2 disabled:!text-g3`}>
                      {deleteFood.isPending ? "Deleting..." : "Delete"}
                    </button>
                    <button onClick={() => setConfirmingDelete(false)} className={`${pillOutline} flex-1 border-transparent text-g5`}>Keep</button>
                  </div>
                </div>
              )
            ) : (
              <button onClick={() => handleClone(detail)} disabled={cloneFood.isPending} className={`${pillOutline} w-full`}>
                {cloneFood.isPending ? "Cloning..." : "Clone to edit"}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );

  return (
    <DashboardLayout title="Foods" hideTitle>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">Foods</h1>
        <div className="flex items-center gap-2">
          <Link href="/scanner" className={`${pillOutline} gap-2 !h-12`}>
            <ScanBarcode className="h-4 w-4" aria-hidden="true" /> Scan
          </Link>
          <button onClick={openCreate} className={pillInk}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add food
          </button>
          <SettingsLink className="-mr-2" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 lg:gap-4">
        <div className="lg:col-span-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-g4" aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search foods"
              aria-label="Search foods"
              className="h-12 w-full rounded-full border border-g3 bg-g0 pl-10 pr-12 text-base text-ink outline-none placeholder:text-g4 focus:border-ink"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(""); setPage(1); }}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-g4 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <p className="mb-1 mt-3 flex justify-between text-[12px] text-g4">
            <span>{data ? `${data.total} ${data.total === 1 ? "food" : "foods"}` : "\u00a0"}</span>
            <span>Values per 100 g</span>
          </p>

          {isError ? (
            <div className="border-y border-g2 py-8">
              <p className="text-[15px] text-ink">{getErrorMessage(error, "Couldn't load foods.")}</p>
              <button onClick={() => refetch()} className={`${pillOutline} mt-3`}>Try again</button>
            </div>
          ) : loading && !data ? (
            <div className="space-y-px" aria-busy="true" aria-label="Loading foods">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-[60px] animate-pulse bg-g1" />
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="border-y border-g2 py-8">
              <p className="text-[15px] text-g4">
                {debouncedQuery ? `Nothing matches "${debouncedQuery}". Check the spelling or add it yourself.` : "No foods yet. Add the first one."}
              </p>
              <button onClick={openCreate} className={`${pillInk} mt-4`}>
                <Plus className="h-4 w-4" aria-hidden="true" /> Add food
              </button>
            </div>
          ) : (
            <>
              <ul className={`divide-y divide-g2 border-y border-g2 transition-opacity duration-150 ${loading ? "opacity-60" : ""}`}>
                {data.items.map((food) => {
                  const selected = selectedId === food.id;
                  return (
                    <li key={food.id ?? food.name}>
                      <button
                        onClick={() => selectFood(food.id)}
                        aria-pressed={selected}
                        className={`grid min-h-[60px] w-full grid-cols-[1fr_auto] items-center gap-x-4 px-3 py-2 text-left transition-colors outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink hover:bg-g1 ${selected ? "bg-g1" : ""}`}
                      >
                        <span className="min-w-0">
                          <span className={`block truncate text-base ${selected ? "font-medium text-ink" : "text-ink"}`}>{food.name}</span>
                          <span className="block truncate text-[12px] text-g4">
                            {sourceLabel(food.source)}
                            {food.serving_size_g ? ` · ${food.serving_label || "serving"} ${Math.round(food.serving_size_g)} g` : ""}
                          </span>
                        </span>
                        <span className="text-right tabular-nums">
                          <span className="block text-[17px] font-medium text-ink">
                            {food.kcal != null ? Math.round(food.kcal) : "--"}
                            <span className="ml-1 text-[12px] font-normal text-g4">kcal</span>
                          </span>
                          {showProtein && (
                            <span className="block text-[12px]" style={{ color: food.protein != null ? plateOf("protein") : "var(--g4)" }}>
                              {food.protein != null ? `${Math.round(food.protein)} g protein` : "-- protein"}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {data.pages > 1 && (
                <div className="mt-3 flex items-center justify-between">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className={pillOutline}>Previous</button>
                  <span className="text-[12px] tabular-nums text-g4">{page} / {data.pages}</span>
                  <button onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={page === data.pages} className={pillOutline}>Next</button>
                </div>
              )}
            </>
          )}
        </div>

        {/* The breakdown sits beside the list from 1024px; below that it opens as a dialog. */}
        <aside className="clay-card hidden self-start p-5 lg:block lg:sticky lg:top-6">
          <h2 className="mb-3 text-[15px] font-medium text-ink">What is in it</h2>
          {detailBody}
        </aside>
      </div>

      <Dialog
        open={!isDesktop && !!selectedId && !formOpen && !logOpen}
        onOpenChange={(next) => { if (!next) { setSelectedId(null); setConfirmingDelete(false); } }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>What is in it</DialogTitle>
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
