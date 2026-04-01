"use client";

import { useState } from "react";
import type { MealGroup, MealItem } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";
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
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  function toggle(mealType: string) {
    setCollapsed((prev) => ({ ...prev, [mealType]: !prev[mealType] }));
  }

  function toggleItem(key: string) {
    setExpandedItem((prev) => (prev === key ? null : key));
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
                  {group.items.map((item, i) => {
                    const itemKey = `${group.meal_type}-${i}`;
                    const isExpanded = expandedItem === itemKey;
                    return (
                      <div key={i}>
                        <button
                          onClick={() => toggleItem(itemKey)}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm cursor-pointer transition-all duration-150 border-l-2 ${
                            isExpanded
                              ? "bg-muted/40 border-primary/50"
                              : "border-transparent hover:bg-muted/20 hover:border-primary/20"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <svg
                              className={`h-3 w-3 text-muted-foreground/50 shrink-0 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="text-foreground/80 truncate">{item.food_name}</span>
                            <span className="text-xs text-muted-foreground/50 shrink-0">{item.quantity_g}g</span>
                          </div>
                          <span className="tabular-nums text-muted-foreground shrink-0 ml-2">
                            {item.kcal != null ? `${Math.round(item.kcal)} kcal` : "\u2014"}
                          </span>
                        </button>
                        {/* Nutrient detail panel */}
                        <div
                          className={`overflow-hidden transition-all duration-200 ease-out ${
                            isExpanded ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
                          }`}
                        >
                          <div className="ml-7 mr-2 mt-1 mb-2 grid grid-cols-4 gap-x-4 gap-y-1.5 px-3 py-2.5 rounded-lg bg-muted/20">
                            {NUTRIENT_COLORS.map((n) => {
                              const val = item[n.key];
                              if (val == null || (typeof val === "number" && val === 0 && n.key === "alcohol")) return null;
                              return (
                                <div key={n.key} className="flex items-baseline gap-1">
                                  <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: n.color }} />
                                  <span className="text-[11px] text-muted-foreground">{n.label}</span>
                                  <span className="text-[11px] font-medium tabular-nums text-foreground ml-auto">
                                    {typeof val === "number" ? fmt(val) : val}{n.unit}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
