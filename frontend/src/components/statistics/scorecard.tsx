"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ScoreGroup } from "./scorecard-row";
import { MetricRow, type Metric } from "./metric-row";
import { MacroRow } from "./macro-trends-card";
import { MicroRow, MICROS } from "./micronutrient-averages-card";
import { SupplementRow } from "./supplement-consistency-card";
import { RecordsGroup } from "./records-card";
import type { DailyNutritionLike } from "@/lib/chart-utils";
import { withRollingAvg } from "@/lib/chart-utils";
import { plateOf } from "@/lib/plates";
import { useTracked } from "@/hooks/use-tracked";
import type { StatsSummary } from "@/lib/types";

export interface Targets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  alcohol: number;
  waterMl: number;
  caffeineMg: number;
}

interface Props {
  data: StatsSummary;
  nutrition: unknown[];
  rolling: (DailyNutritionLike & Record<string, number>)[];
  targets: Targets;
  days: number;
}

/**
 * The scorecard: ruled rows under the page's sections, each with the answer in words, a sparkline
 * and a status word. A tap opens that row's full chart in place; one row is open at a time. A hidden
 * nutrient's row drops out, and a section with nothing visible is not rendered.
 */
export function Scorecard({ data, nutrition, rolling, targets, days }: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const { shows } = useTracked();
  const toggle = (key: string) => setOpenKey((k) => (k === key ? null : key));
  const rowProps = (key: string) => ({ open: openKey === key, onToggle: () => toggle(key) });

  const water = useMemo(() => withRollingAvg(data.daily_water ?? [], "total_ml"), [data.daily_water]);
  const caffeine = useMemo(() => withRollingAvg(data.daily_caffeine ?? [], "total_mg"), [data.daily_caffeine]);

  // Nutrition metrics count only days with something logged.
  const logged = rolling.filter((d) => d.kcal > 0);
  const fromNutrition = (key: "kcal" | "fiber" | "sugar" | "sodium" | "alcohol", name: string, unit: string, target: number, mode: Metric["mode"], noun: Metric["noun"]): Metric => ({
    key, name, plate: key, unit, target, mode, noun,
    rows: nutrition.length === 0 ? [] : rolling,
    rawKey: key,
    avgKey: `avg_${key}`,
    counted: logged.map((d) => Number(d[key]) || 0),
    emptyText: "Nothing logged in this period.",
  });

  const kcal = fromNutrition("kcal", "Calories", "kcal", targets.kcal, "range", "target");
  const alcohol = fromNutrition("alcohol", "Alcohol", "g", targets.alcohol, targets.alcohol > 0 ? "limit" : "none", "limit");
  const waterMetric: Metric = {
    key: "water", name: "Water", plate: "water", unit: "ml", target: targets.waterMl, mode: "goal", noun: "target",
    rows: water, rawKey: "total_ml", avgKey: "avg_total_ml", counted: water.map((d) => d.total_ml), emptyText: "No water logged in this period.",
  };
  const caffeineMetric: Metric = {
    key: "caffeine", name: "Caffeine", plate: "caffeine", unit: "mg", target: targets.caffeineMg, mode: "limit", noun: "limit",
    rows: caffeine, rawKey: "total_mg", avgKey: "avg_total_mg", counted: caffeine.map((d) => d.total_mg), emptyText: "No caffeine logged in this period.",
  };

  const drinks = [
    shows("water") && waterMetric,
    shows("caffeine") && caffeineMetric,
    shows("alcohol") && alcohol,
  ].filter((m): m is Metric => !!m);
  const details = [
    shows("fiber") && fromNutrition("fiber", "Fiber", "g", targets.fiber, "goal", "target"),
    shows("sugar") && fromNutrition("sugar", "Sugar", "g", targets.sugar, "limit", "limit"),
    shows("sodium") && fromNutrition("sodium", "Sodium", "mg", targets.sodium, "limit", "limit"),
  ].filter((m): m is Metric => !!m);

  return (
    <>
      <ScoreGroup title="Energy" swatches={[plateOf("protein"), plateOf("carbs"), plateOf("fat")]}>
        <MetricRow metric={kcal} {...rowProps("kcal")} />
        <MacroRow
          nutritionLength={nutrition.length}
          rollingNutrition={rolling}
          macroAvg={data.macro_avg}
          targetProtein={targets.protein}
          targetCarbs={targets.carbs}
          targetFat={targets.fat}
          {...rowProps("macros")}
        />
      </ScoreGroup>

      {drinks.length > 0 && (
        <ScoreGroup title="Drinks" swatches={[plateOf("water"), plateOf("caffeine"), plateOf("alcohol")]}>
          {drinks.map((m) => <MetricRow key={m.key} metric={m} {...rowProps(m.key)} />)}
        </ScoreGroup>
      )}

      {details.length > 0 && (
        <ScoreGroup title="Details" swatches={[plateOf("fiber"), "var(--ink)"]}>
          {details.map((m) => <MetricRow key={m.key} metric={m} {...rowProps(m.key)} />)}
        </ScoreGroup>
      )}

      {MICROS.some((m) => shows(m.key)) && (
        <ScoreGroup title="Vitamins and minerals">
          <MicroRow microAvg={data.micro_avg} {...rowProps("micros")} />
        </ScoreGroup>
      )}

      <ScoreGroup title="Habits" swatches={["var(--done)"]}>
        <SupplementRow supplementLog={data.supplement_log ?? []} days={days} {...rowProps("supplements")} />
        <li className="border-b border-g2">
          <Link href="/body" className="flex min-h-[64px] items-center justify-between gap-3 py-3 text-[17px] font-medium text-ink transition-colors hover:text-g5">
            <span>
              Weight and body
              <span className="mt-0.5 block text-[13px] font-normal text-g4">see Body</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-g4" aria-hidden="true" />
          </Link>
        </li>
      </ScoreGroup>

      <RecordsGroup data={data} />
    </>
  );
}
