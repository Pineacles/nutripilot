"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { invalidateFoods } from "./foods";
import type { FoodDetail } from "@/lib/types";

export interface FoodCorrectionInput {
  barcode: string;
  body: {
    serving_size_g?: number;
    serving_label?: string;
    name?: string;
    nutrients?: Record<string, number>;
  };
}

export function useCorrectFoodByBarcode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ barcode, body }: FoodCorrectionInput) =>
      apiFetch<FoodDetail>(`/api/foods/barcode/${barcode}/correction`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    // Corrections fix past days too, so their totals are refetched.
    onSuccess: (food) => invalidateFoods(queryClient, food.id),
  });
}
