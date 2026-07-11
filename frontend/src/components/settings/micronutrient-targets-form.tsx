"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUpdateMicronutrientTargets } from "@/hooks/queries";
import type { MicronutrientTargetItem } from "@/lib/types";

const DEFAULT_MICRO_TARGETS: MicronutrientTargetItem[] = [
  { nutrient: "vitamin_d", target_value: 20, unit: "µg" },
  { nutrient: "zinc", target_value: 10, unit: "mg" },
  { nutrient: "omega3", target_value: 1000, unit: "mg" },
  { nutrient: "creatine", target_value: 5, unit: "g" },
  { nutrient: "fiber", target_value: 30, unit: "g" },
  { nutrient: "iron", target_value: 8, unit: "mg" },
];

const MICRO_LABELS: Record<string, string> = {
  vitamin_d: "Vitamin D",
  zinc: "Zinc",
  omega3: "Omega-3",
  creatine: "Creatine",
  fiber: "Fiber",
  iron: "Iron",
  calcium: "Calcium",
  magnesium: "Magnesium",
  b12: "B12",
  vit_c: "Vitamin C",
  potassium: "Potassium",
};

interface Props {
  initial: MicronutrientTargetItem[] | undefined;
}

export function MicronutrientTargetsForm({ initial }: Props) {
  const [microTargets, setMicroTargets] = useState<MicronutrientTargetItem[]>(DEFAULT_MICRO_TARGETS);
  const updateMicroTargets = useUpdateMicronutrientTargets();

  useEffect(() => {
    if (!initial) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setMicroTargets(initial.length > 0 ? initial : DEFAULT_MICRO_TARGETS);
    });
    return () => {
      cancelled = true;
    };
  }, [initial]);

  function saveMicroTargets() {
    updateMicroTargets.mutate(microTargets, {
      onSuccess: () => toast.success("Micronutrient targets saved"),
    });
  }

  return (
    <div className="clay-card p-5 md:col-span-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Micronutrient Daily Targets</h3>
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground uppercase tracking-wide px-1">
          <span>Micronutrient</span>
          <span>Daily Target</span>
          <span>Unit</span>
        </div>
        {microTargets.map((t, i) => (
          <div key={t.nutrient} className="grid grid-cols-3 gap-2 items-center">
            <span className="text-sm text-foreground/70">{MICRO_LABELS[t.nutrient] || t.nutrient}</span>
            <Input
              type="number"
              value={t.target_value}
              onChange={(e) => {
                const val = Number(e.target.value);
                setMicroTargets((prev) =>
                  prev.map((mt, j) => (j === i ? { ...mt, target_value: val } : mt))
                );
              }}
              className="tabular-nums"
            />
            <span className="text-xs text-muted-foreground">{t.unit}</span>
          </div>
        ))}
      </div>
      <Button
        onClick={saveMicroTargets}
        disabled={updateMicroTargets.isPending}
        className="mt-3 w-full"
        size="lg"
      >
        {updateMicroTargets.isPending ? "Saving..." : "Save Targets"}
      </Button>
    </div>
  );
}
