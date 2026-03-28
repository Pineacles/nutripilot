"use client";

import { useEffect, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { DashboardCard } from "@/components/dashboard-card";
import { apiFetch } from "@/lib/api";

interface FoodItem {
  id: string;
  name: string;
  barcode: string | null;
  source: string;
  kcal: number | null;
  protein: number | null;
}

interface FoodDetail {
  id: string;
  name: string;
  barcode: string | null;
  source: string;
  nutrients: Record<string, number | null> | null;
}

interface FoodsPage {
  items: FoodItem[];
  total: number;
  page: number;
  pages: number;
}

const NUTRIENT_LABELS: Record<string, { label: string; unit: string }> = {
  kcal: { label: "Calories", unit: "kcal" },
  protein: { label: "Protein", unit: "g" },
  carbs: { label: "Carbs", unit: "g" },
  fat: { label: "Fat", unit: "g" },
  fiber: { label: "Fiber", unit: "g" },
  sugar: { label: "Sugar", unit: "g" },
  sat_fat: { label: "Sat. Fat", unit: "g" },
  salt: { label: "Salt", unit: "g" },
  calcium: { label: "Calcium", unit: "mg" },
  potassium: { label: "Potassium", unit: "mg" },
  iron: { label: "Iron", unit: "mg" },
  zinc: { label: "Zinc", unit: "mg" },
  magnesium: { label: "Magnesium", unit: "mg" },
  vit_d: { label: "Vitamin D", unit: "µg" },
  vit_c: { label: "Vitamin C", unit: "mg" },
  vit_k2: { label: "Vitamin K2", unit: "µg" },
  b12: { label: "Vitamin B12", unit: "µg" },
  omega3: { label: "Omega-3", unit: "mg" },
};

export default function FoodsPage() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<FoodsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FoodDetail | null>(null);

  const loadFoods = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<FoodsPage>(
        `/api/dashboard/foods?q=${encodeURIComponent(query)}&page=${page}&limit=20`
      );
      setData(result);
    } catch {}
    setLoading(false);
  }, [query, page]);

  useEffect(() => {
    const timer = setTimeout(loadFoods, 300);
    return () => clearTimeout(timer);
  }, [loadFoods]);

  async function selectFood(id: string) {
    if (selectedId === id) {
      setSelectedId(null);
      setDetail(null);
      return;
    }
    setSelectedId(id);
    try {
      const d = await apiFetch<FoodDetail>(`/api/dashboard/foods/${id}`);
      setDetail(d);
    } catch {}
  }

  return (
    <DashboardLayout title="Food Database">
      <div className="grid grid-cols-3 gap-4">
        {/* Food list (2 cols) */}
        <DashboardCard title="Foods" className="col-span-2">
          <div className="mb-3">
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search foods..."
              className="w-full rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-[#22c55e]/50"
            />
          </div>

          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#22c55e] border-t-transparent" />
            </div>
          ) : !data || data.items.length === 0 ? (
            <p className="text-sm text-white/30 py-4">No foods found</p>
          ) : (
            <>
              <div className="space-y-1">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 px-3 py-1 text-[10px] text-white/30 uppercase tracking-wide">
                  <span className="col-span-5">Name</span>
                  <span className="col-span-2">Source</span>
                  <span className="col-span-2 text-right">Kcal</span>
                  <span className="col-span-2 text-right">Protein</span>
                  <span className="col-span-1"></span>
                </div>
                {data.items.map((food) => (
                  <button
                    key={food.id}
                    onClick={() => selectFood(food.id)}
                    className={`grid grid-cols-12 gap-2 w-full items-center rounded-lg px-3 py-2 text-sm text-left transition-colors ${
                      selectedId === food.id ? "bg-[#22c55e]/10" : "hover:bg-white/5"
                    }`}
                  >
                    <span className="col-span-5 text-white/80 truncate">{food.name}</span>
                    <span className="col-span-2 text-xs text-white/30">{food.source}</span>
                    <span className="col-span-2 text-right tabular-nums text-white/60">
                      {food.kcal != null ? Math.round(food.kcal) : "—"}
                    </span>
                    <span className="col-span-2 text-right tabular-nums text-white/60">
                      {food.protein != null ? `${Math.round(food.protein)}g` : "—"}
                    </span>
                    <span className="col-span-1 text-right">
                      <svg className={`h-3.5 w-3.5 text-white/20 inline transition-transform ${selectedId === food.id ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </button>
                ))}
              </div>

              {/* Pagination */}
              {data.pages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                  <span className="text-xs text-white/30">{data.total} foods total</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="rounded-lg px-3 py-1 text-xs text-white/50 hover:bg-white/5 disabled:opacity-20"
                    >
                      Prev
                    </button>
                    <span className="px-2 py-1 text-xs text-white/40 tabular-nums">
                      {page} / {data.pages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                      disabled={page === data.pages}
                      className="rounded-lg px-3 py-1 text-xs text-white/50 hover:bg-white/5 disabled:opacity-20"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </DashboardCard>

        {/* Nutrient detail (1 col) */}
        <DashboardCard title="Nutrient Breakdown" className="col-span-1">
          {!detail ? (
            <p className="text-sm text-white/30">Select a food to see nutrients</p>
          ) : (
            <div>
              <h4 className="text-base font-semibold text-white mb-1">{detail.name}</h4>
              {detail.barcode && (
                <p className="text-xs text-white/30 mb-3 font-mono">{detail.barcode}</p>
              )}
              {detail.nutrients ? (
                <div className="space-y-2">
                  {Object.entries(NUTRIENT_LABELS).map(([key, meta]) => {
                    const val = detail.nutrients?.[key];
                    if (val == null) return null;
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-xs text-white/60">{meta.label}</span>
                        <span className="text-xs tabular-nums text-white font-medium">
                          {Math.round(val * 10) / 10} {meta.unit}
                        </span>
                      </div>
                    );
                  })}
                  <p className="text-[9px] text-white/20 mt-2 pt-2 border-t border-white/5">
                    Values per 100g · Source: {detail.source}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-white/30">No nutrient data available</p>
              )}
            </div>
          )}
        </DashboardCard>
      </div>
    </DashboardLayout>
  );
}
