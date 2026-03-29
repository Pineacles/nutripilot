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
                  className={`ml-8 space-y-1 overflow-hidden transition-all duration-300 ease-in-out ${
                    isCollapsed ? "max-h-0 opacity-0 pb-0" : "max-h-[500px] opacity-100 pb-2 pt-1"
                  }`}
                >
                  {group.items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-all duration-200 hover:bg-muted/30 border-l-2 border-transparent hover:border-primary/30"
                    >
                      <div>
                        <span className="text-foreground/80">{item.food_name}</span>
                        <span className="ml-2 text-xs text-muted-foreground/60">{item.quantity_g}g</span>
                      </div>
                      <span className="tabular-nums text-muted-foreground">
                        {item.kcal != null ? `${Math.round(item.kcal)} kcal` : "\u2014"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
