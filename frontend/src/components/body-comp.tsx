"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { BodyCompEntry } from "@/lib/types";
import { fmt } from "@/lib/utils";
import { DashboardCard } from "./dashboard-card";
import { BODY_INK, BODY_RULE, BODY_SOFT, BODY_TICK, BODY_TOOLTIP_STYLE, usePrefersReducedMotion } from "@/lib/body-chart-utils";

/* Body metrics are not nutrients: ink and g5, never the macro plate inks. */
const COLOR_BODY_FAT = BODY_INK;
const COLOR_MUSCLE = BODY_SOFT;

interface Props {
  data: BodyCompEntry[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const day = new Date(label).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" });
  return (
    <div style={BODY_TOOLTIP_STYLE}>
      <p style={{ color: "var(--g4)", marginBottom: 2 }}>{day}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: "var(--ink)" }}>
          {p.dataKey === "body_fat_pct" ? "Body fat" : "Muscle"}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value}%
        </p>
      ))}
    </div>
  );
}

export function BodyCompCard({ data }: Props) {
  const still = usePrefersReducedMotion();
  const hasFat = data.some((d) => d.body_fat_pct != null);
  const hasMuscle = data.some((d) => d.muscle_mass_pct != null);

  if (!hasFat && !hasMuscle) {
    return (
      <DashboardCard title="Body composition" span="lg:col-span-1">
        <p className="text-[15px] text-g4">No body fat or muscle logged yet. Add a measurement on the Body page.</p>
      </DashboardCard>
    );
  }

  // Compute deltas for fat and muscle
  const fatPoints = data.filter((d) => d.body_fat_pct != null);
  const musclePoints = data.filter((d) => d.muscle_mass_pct != null);
  const latestFat = fatPoints.length > 0 ? fatPoints[fatPoints.length - 1].body_fat_pct : null;
  const firstFat = fatPoints.length > 1 ? fatPoints[0].body_fat_pct : null;
  const latestMuscle = musclePoints.length > 0 ? musclePoints[musclePoints.length - 1].muscle_mass_pct : null;
  const firstMuscle = musclePoints.length > 1 ? musclePoints[0].muscle_mass_pct : null;

  // Y-axis domain from all values
  const allVals: number[] = [];
  data.forEach((d) => {
    if (d.body_fat_pct != null) allVals.push(d.body_fat_pct);
    if (d.muscle_mass_pct != null) allVals.push(d.muscle_mass_pct);
  });
  const min = Math.floor(Math.min(...allVals) - 2);
  const max = Math.ceil(Math.max(...allVals) + 2);

  return (
    <DashboardCard title="Body composition" span="lg:col-span-1">
      <div className="mb-4 grid grid-cols-2 divide-x divide-g2 border-y border-g2 tabular-nums" style={{ gridTemplateColumns: `repeat(${[latestFat, latestMuscle].filter((v) => v != null).length}, 1fr)` }}>
        {latestFat != null && (
          <div className="px-3 py-3 first:pl-0">
            <p className="flex items-center gap-2 text-[12px] text-g4">
              <svg width="14" height="2" aria-hidden="true"><line x1="0" y1="1" x2="14" y2="1" stroke={COLOR_BODY_FAT} strokeWidth="2" /></svg>
              Body fat
            </p>
            <p className="mt-0.5 text-[22px] font-medium leading-tight text-ink">
              {fmt(latestFat)}<span className="text-[12px] font-normal text-g4">%</span>
            </p>
            {firstFat != null && (
              <p className="text-[12px] text-g4">{latestFat > firstFat ? "+" : latestFat < firstFat ? "-" : ""}{Math.abs(latestFat - firstFat).toFixed(1)} this week</p>
            )}
          </div>
        )}
        {latestMuscle != null && (
          <div className="px-3 py-3 first:pl-0">
            <p className="flex items-center gap-2 text-[12px] text-g4">
              <svg width="14" height="2" aria-hidden="true"><line x1="0" y1="1" x2="14" y2="1" stroke={COLOR_MUSCLE} strokeWidth="2" /></svg>
              Muscle
            </p>
            <p className="mt-0.5 text-[22px] font-medium leading-tight text-ink">
              {fmt(latestMuscle)}<span className="text-[12px] font-normal text-g4">%</span>
            </p>
            {firstMuscle != null && (
              <p className="text-[12px] text-g4">{latestMuscle > firstMuscle ? "+" : latestMuscle < firstMuscle ? "-" : ""}{Math.abs(latestMuscle - firstMuscle).toFixed(1)} this week</p>
            )}
          </div>
        )}
      </div>
      <ResponsiveContainer minWidth={0} width="100%" height={160}>
        <LineChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={BODY_RULE} vertical={false} />
          <XAxis
            dataKey="date"
            tick={BODY_TICK}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            tickFormatter={(v) => new Date(v).toLocaleDateString("en", { weekday: "short" })}
          />
          <YAxis domain={[min, max]} tick={BODY_TICK} axisLine={false} tickLine={false} width={32} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: BODY_SOFT, strokeWidth: 1 }} />
          {hasFat && (
            <Line
              type="monotone"
              dataKey="body_fat_pct"
              stroke={COLOR_BODY_FAT}
              strokeWidth={2}
              dot={false}
              activeDot={{ fill: COLOR_BODY_FAT, r: 4, stroke: "var(--g1)", strokeWidth: 2 }}
              connectNulls
              isAnimationActive={!still}
              animationDuration={700}
              animationEasing="ease-out"
            />
          )}
          {hasMuscle && (
            <Line
              type="monotone"
              dataKey="muscle_mass_pct"
              stroke={COLOR_MUSCLE}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              activeDot={{ fill: COLOR_MUSCLE, r: 4, stroke: "var(--g1)", strokeWidth: 2 }}
              connectNulls
              isAnimationActive={!still}
              animationDuration={700}
              animationEasing="ease-out"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </DashboardCard>
  );
}
