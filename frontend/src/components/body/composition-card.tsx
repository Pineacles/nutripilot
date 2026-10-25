"use client";

import { useState } from "react";
import { Band, BandEmpty } from "./band";
import { TrendChart, latestAvg } from "./metric-trend-card";
import { fmt } from "@/lib/utils";
import { plateOf, plateTint } from "@/lib/plates";

type DataRow = Record<string, unknown>;

const METRICS = [
  { id: "bf", label: "Body fat %", dataKey: "body_fat_pct", avgKey: "body_fat_pct_avg", suffix: "%", plate: "bodyfat", empty: "No body fat logged. Add it when you add a measurement." },
  { id: "mm", label: "Muscle %", dataKey: "muscle_mass_pct", avgKey: "muscle_mass_pct_avg", suffix: "%", plate: "muscle", empty: "No muscle mass logged. Add it when you add a measurement." },
  { id: "fk", label: "Fat kg", dataKey: "body_fat_kg", avgKey: "body_fat_kg_avg", suffix: " kg", plate: "bodyfat", empty: "No fat mass yet. It follows from weight and body fat." },
  { id: "mk", label: "Muscle kg", dataKey: "muscle_mass_kg", avgKey: "muscle_mass_kg_avg", suffix: " kg", plate: "muscle", empty: "No muscle mass yet. It follows from weight and muscle %." },
] as const;

/** One composition chart: chips pick body fat or muscle, as a percent or in kg. */
export function CompositionCard({ data, span }: { data: DataRow[]; span?: string }) {
  const [id, setId] = useState<(typeof METRICS)[number]["id"]>("bf");
  const metric = METRICS.find((m) => m.id === id) ?? METRICS[0];
  const hasData = data.some((d) => d[metric.dataKey] != null);
  const latest = latestAvg(data, metric.avgKey);
  return (
    <Band title="Composition" aside={latest != null ? `7-day avg ${fmt(latest)}${metric.suffix}` : undefined} className={span}>
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Composition measure">
        {METRICS.map((m) => {
          const on = m.id === id;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={on}
              onClick={() => setId(m.id)}
              style={on ? { borderColor: plateOf(m.plate), background: plateTint(m.plate, 18), color: "var(--ink)" } : undefined}
              className={`h-11 shrink-0 rounded-full border px-4 text-[13px] font-medium transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${on ? "" : "border-g3 bg-g0 text-g5 hover:border-g5"}`}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      {hasData ? (
        <TrendChart data={data} dataKey={metric.dataKey} avgKey={metric.avgKey} height={200} valueSuffix={metric.suffix} color={plateOf(metric.plate)} />
      ) : (
        <BandEmpty>{metric.empty}</BandEmpty>
      )}
    </Band>
  );
}
