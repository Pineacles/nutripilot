"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SettingsSection, FieldRow } from "./section";
import { useTracked } from "@/hooks/use-tracked";
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
  // Bumped after a save: the rows flash once.
  const [saved, setSaved] = useState(0);
  const { shows } = useTracked();

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
      onSuccess: () => {
        toast.success("Micronutrient targets saved");
        setSaved((n) => n + 1);
      },
    });
  }

  const visible = microTargets.map((t, i) => ({ t, i })).filter(({ t }) => shows(t.nutrient));
  // Every vitamin and mineral hidden: one plain line instead of an empty form.
  if (visible.length === 0) {
    return (
      <SettingsSection
        title="Micronutrient daily targets"
        description="All vitamins and minerals are hidden. Show them in Tracked nutrients to set targets."
        className="md:col-span-2"
      >
        <span className="sr-only">No micronutrient targets to show</span>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection title="Micronutrient daily targets" className="md:col-span-2">
      <div className="md:grid md:grid-cols-2 md:gap-x-10">
        {visible.map(({ t, i }) => (
          <FieldRow
            key={`${t.nutrient}-${saved}`}
            label={MICRO_LABELS[t.nutrient] || t.nutrient}
            htmlFor={`mt-${t.nutrient}`}
            unit={t.unit}
            lit={saved > 0}
          >
            <Input
              id={`mt-${t.nutrient}`}
              type="number"
              inputMode="decimal"
              value={t.target_value}
              onChange={(e) => {
                const val = Number(e.target.value);
                setMicroTargets((prev) =>
                  prev.map((mt, j) => (j === i ? { ...mt, target_value: val } : mt))
                );
              }}
              className="w-28 text-right tabular-nums"
            />
          </FieldRow>
        ))}
      </div>
      <Button
        onClick={saveMicroTargets}
        disabled={updateMicroTargets.isPending}
        className="mt-5 w-full md:w-auto md:px-8"
        size="lg"
      >
        {updateMicroTargets.isPending ? "Saving..." : "Save micronutrient targets"}
      </Button>
    </SettingsSection>
  );
}
