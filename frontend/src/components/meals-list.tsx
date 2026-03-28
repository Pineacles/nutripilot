"use client";

import type { MealGroup } from "@/lib/types";

const mealOrder = ["breakfast", "lunch", "dinner", "snack"];
const mealLabels: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

interface Props {
  meals: MealGroup[];
}

export function MealsList({ meals }: Props) {
  const sorted = [...meals].sort(
    (a, b) => mealOrder.indexOf(a.meal_type) - mealOrder.indexOf(b.meal_type)
  );

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-[#2a2a30] bg-[#1a1a1f] p-4">
        <p className="text-sm text-[#888]">No meals logged today</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((group) => (
        <div
          key={group.meal_type}
          className="rounded-xl border border-[#2a2a30] bg-[#1a1a1f] p-4 transition-all hover:border-[#3a3a40]"
        >
          <h3 className="text-xs font-medium uppercase tracking-wider text-[#888] mb-3">
            {mealLabels[group.meal_type] || group.meal_type}
          </h3>
          <div className="space-y-2">
            {group.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div>
                  <span className="text-sm">{item.food_name}</span>
                  <span className="ml-2 text-xs text-[#888]">{item.quantity_g}g</span>
                </div>
                <span className="text-sm tabular-nums text-[#888]">
                  {item.kcal != null ? `${Math.round(item.kcal)} kcal` : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
