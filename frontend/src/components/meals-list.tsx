"use client";

import { useState } from "react";
import type { MealGroup, MealItem } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmt } from "@/lib/utils";

const mealOrder = ["breakfast", "lunch", "dinner", "snack"];
const mealLabels: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

const NUTRIENT_COLORS: { key: keyof MealItem; label: string; unit: string; color: string }[] = [
  { key: "protein", label: "Protein", unit: "g", color: "#22c55e" },
  { key: "carbs", label: "Carbs", unit: "g", color: "#3b82f6" },
  { key: "fat", label: "Fat", unit: "g", color: "#f59e0b" },
  { key: "fiber", label: "Fiber", unit: "g", color: "#84cc16" },
  { key: "sugar", label: "Sugar", unit: "g", color: "#ec4899" },
  { key: "sodium", label: "Sodium", unit: "mg", color: "#a78bfa" },
  { key: "alcohol", label: "Alcohol", unit: "g", color: "#f97316" },
];

interface Props {
  meals: MealGroup[];
}

export function MealsLogCard({ meals }: Props) {
  const sorted = [...meals].sort(
    (a, b) => mealOrder.indexOf(a.meal_type) - mealOrder.indexOf(b.meal_type)
  );

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selectedItem, setSelectedItem] = useState<{ item: MealItem; mealType: string } | null>(null);

  function toggle(mealType: string) {
    setCollapsed((prev) => ({ ...prev, [mealType]: !prev[mealType] }));
  }

  return (
    <DashboardCard title="Meals" span="lg:col-span-2">
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No meals logged today</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((group) => {
            const isCollapsed = collapsed[group.meal_type];
            const groupKcal = group.items.reduce((sum, item) => sum + (item.kcal || 0), 0);
            return (
              <div key={group.meal_type}>
                <button
                  onClick={() => toggle(group.meal_type)}
                  className="pill flex w-full items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 hover:bg-white/[0.03]"
                >
                  <div className="flex items-center gap-2">
                    <svg
                      className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isCollapsed ? "" : "rotate-90"}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-sm font-medium text-foreground/80">
                      {mealLabels[group.meal_type] || group.meal_type}
                    </span>
                    <span className="text-xs text-muted-foreground">{group.items.length} items</span>
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {Math.round(groupKcal)} kcal
                  </span>
                </button>
                <div
                  className={`ml-8 space-y-0.5 overflow-hidden transition-all duration-300 ease-in-out ${
                    isCollapsed ? "max-h-0 opacity-0 pb-0" : "max-h-[1000px] opacity-100 pb-2 pt-1"
                  }`}
                >
                  {group.items.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedItem({ item, mealType: group.meal_type })}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm cursor-pointer transition-all duration-150 border-l-2 border-transparent hover:bg-muted/20 hover:border-primary/20"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-foreground/80 truncate">{item.food_name}</span>
                        <span className="text-xs text-muted-foreground/50 shrink-0">{item.quantity_g}g</span>
                      </div>
                      <span className="tabular-nums text-muted-foreground shrink-0 ml-2">
                        {item.kcal != null ? `${Math.round(item.kcal)} kcal` : "\u2014"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg">{selectedItem?.item.food_name}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {selectedItem?.item.quantity_g}g · {mealLabels[selectedItem?.mealType || ""] || selectedItem?.mealType}
            </p>
          </DialogHeader>
          {selectedItem && (
            <div className="overflow-y-auto flex-1 -mx-1 px-1 thin-scrollbar">
              <div className="space-y-1.5 py-2">
                {/* Calories row */}
                <div className="pill rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#ef4444" }} />
                      <span className="text-sm text-foreground">Calories</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {selectedItem.item.kcal != null ? `${fmt(selectedItem.item.kcal)} kcal` : "\u2014"}
                    </span>
                  </div>
                </div>
                {/* Nutrient rows */}
                {NUTRIENT_COLORS.map((n) => {
                  const val = selectedItem.item[n.key];
                  if (val == null) return null;
                  if (typeof val === "number" && val === 0 && n.key === "alcohol") return null;
                  return (
                    <div key={n.key} className="pill rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: n.color }} />
                          <span className="text-sm text-foreground">{n.label}</span>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {typeof val === "number" ? fmt(val) : val} {n.unit}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardCard>
  );
}
