"use client";

import { useState } from "react";
import type { MealGroup } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";

const mealOrder = ["breakfast", "lunch", "dinner", "snack"];
const mealLabels: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

interface Props {
  meals: MealGroup[];
}

export function MealsLogCard({ meals }: Props) {
  const sorted = [...meals].sort(
    (a, b) => mealOrder.indexOf(a.meal_type) - mealOrder.indexOf(b.meal_type)
  );

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggle(mealType: string) {
    setCollapsed((prev) => ({ ...prev, [mealType]: !prev[mealType] }));
  }

  return (
    <DashboardCard title="Meals" className="col-span-2">
      {sorted.length === 0 ? (
        <p className="text-sm text-white/30">No meals logged today</p>
      ) : (
        <div className="space-y-1">
          {sorted.map((group) => {
            const isCollapsed = collapsed[group.meal_type];
            const groupKcal = group.items.reduce((sum, item) => sum + (item.kcal || 0), 0);
            return (
              <div key={group.meal_type}>
                <button
                  onClick={() => toggle(group.meal_type)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-white/5"
                >
                  <div className="flex items-center gap-2">
                    <svg
                      className={`h-3.5 w-3.5 text-white/30 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-sm font-medium text-white/70">
                      {mealLabels[group.meal_type] || group.meal_type}
                    </span>
                    <span className="text-xs text-white/30">{group.items.length} items</span>
                  </div>
                  <span className="text-sm tabular-nums text-white/50">
                    {Math.round(groupKcal)} kcal
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="ml-8 space-y-1 pb-2">
                    {group.items.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm"
                      >
                        <div>
                          <span className="text-white/80">{item.food_name}</span>
                          <span className="ml-2 text-xs text-white/25">{item.quantity_g}g</span>
                        </div>
                        <span className="tabular-nums text-white/40">
                          {item.kcal != null ? `${Math.round(item.kcal)} kcal` : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
