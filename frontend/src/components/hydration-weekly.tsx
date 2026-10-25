"use client";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, ReferenceLine, ReferenceArea, Tooltip, Cell } from "recharts";
import type { DailyWater, DailyCaffeine } from "@/lib/types";
import { SectionCard, SectionEmpty } from "@/components/charts/section-card";
import { POSTER_CURSOR_BAR, POSTER_TARGET_LINE, POSTER_X_AXIS } from "@/lib/chart-theme";
import { TT_STYLE } from "@/components/statistics/chart-tooltip";
import { countDays, daysWord, meanOf, niceCeil, todayKey, useChartMotion } from "@/lib/chart-utils";
import { ALERT, plateOf, plateTint } from "@/lib/plates";
import { useTracked } from "@/hooks/use-tracked";

/* eslint-disable @typescript-eslint/no-explicit-any */
function DrinkTooltip({ active, payload, label, unit, limit, target }: any) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div style={TT_STYLE}>
      <p style={{ color: "var(--g4)", fontSize: 12 }}>{label}</p>
      <p style={{ fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
        {Math.round(v).toLocaleString("en-US")} {unit}
        {limit && target > 0 && v > target && <span style={{ color: "var(--alert)", marginLeft: 8, fontWeight: 600 }}>over</span>}
        {!limit && target > 0 && v > 0 && v < target * 0.9 && <span style={{ color: "var(--alert)", marginLeft: 8, fontWeight: 600 }}>low</span>}
      </p>
    </div>
  );
}

interface Props {
  dailyWater: DailyWater[];
  dailyCaffeine: DailyCaffeine[];
  targetWater: number;
  targetCaffeine: number;
}

/**
 * One small bar strip per drink in its plate: a tint, today in full, a goal a faint zone with its
 * rule, a limit only the rule. A limit (caffeine) turns a day over it --alert; a goal (water) says "low" on hover.
 */
function DrinkStrip({ label, plate, unit, limit, note, data, target }: {
  label: string; plate: string; unit: string; limit: boolean; note: React.ReactNode; data: { day: string; value: number; isToday: boolean }[]; target: number;
}) {
  const motion = useChartMotion();
  const zone: [number, number] | null = limit ? null : [target * 0.9, target * 1.1];
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-[12px] text-g4">{label}</p>
        <p className="text-[12px] tabular-nums text-g4">{note}</p>
      </div>
      <ResponsiveContainer minWidth={0} width="100%" height={96}>
        <BarChart data={data} barCategoryGap="22%" margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <XAxis dataKey="day" {...POSTER_X_AXIS} />
          <YAxis hide domain={[0, (max: number) => niceCeil(Math.max(max, target) * 1.05)]} />
          <Tooltip content={<DrinkTooltip unit={unit} limit={limit} target={target} />} cursor={POSTER_CURSOR_BAR} />
          {zone && <ReferenceArea y1={zone[0]} y2={zone[1]} ifOverflow="hidden" fill={plateTint(plate, 10)} fillOpacity={1} stroke="none" />}
          <ReferenceLine y={target} {...POSTER_TARGET_LINE} />
          <Bar dataKey="value" radius={0} {...motion}>
            {data.map((entry, i) => (
              <Cell key={i} fill={limit && target > 0 && entry.value > target ? ALERT : entry.isToday ? plateOf(plate) : plateTint(plate, 60)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HydrationWeeklyCard({ dailyWater, dailyCaffeine, targetWater, targetCaffeine }: Props) {
  const { shows } = useTracked();
  const today = todayKey();
  const dayName = (date: string) => new Date(date + "T00:00:00").toLocaleDateString("en", { weekday: "short" });
  const waterData = dailyWater.map((d) => ({ day: dayName(d.date), value: Math.round(d.total_ml), isToday: d.date === today }));
  const caffData = dailyCaffeine.map((d) => ({ day: dayName(d.date), value: Math.round(d.total_mg), isToday: d.date === today }));

  const showWater = shows("water");
  const showCaffeine = shows("caffeine");
  if (!showWater && !showCaffeine) return null;

  const hasWater = showWater && waterData.some((d) => d.value > 0);
  const hasCaff = showCaffeine && caffData.some((d) => d.value > 0);
  const loggedWater = waterData.filter((d) => d.value > 0).map((d) => d.value);
  const loggedCaff = caffData.filter((d) => d.value > 0).map((d) => d.value);
  const underDays = countDays(loggedWater, (v) => v < targetWater).n;
  const overDays = countDays(loggedCaff, (v) => v > targetCaffeine).n;
  const waterPart = underDays === 0 ? "water on target" : `water under target on ${daysWord(underDays)}`;
  const caffPart = overDays === 0 ? "caffeine within the limit" : `caffeine over the limit on ${daysWord(overDays)}`;
  const parts = [hasWater ? waterPart : null, hasCaff ? caffPart : null].filter(Boolean) as string[];
  const lead = showWater && showCaffeine ? "Drinks" : showWater ? "Water" : "Caffeine";
  const answer = showWater && showCaffeine ? parts.join(", ") : (parts[0] ?? "").replace(/^(water|caffeine) /, "");
  const title = parts.length ? `${lead}: ${answer}` : lead;

  if (!hasWater && !hasCaff) {
    return (
      <SectionCard title={title}>
        <SectionEmpty>Nothing logged this week.</SectionEmpty>
      </SectionCard>
    );
  }

  const waterAvg = meanOf(waterData.map((d) => d.value)) ?? 0;
  const caffAvg = meanOf(caffData.map((d) => d.value)) ?? 0;
  return (
    <SectionCard title={title}>
      <div className="space-y-5">
        {hasWater && (
          <DrinkStrip label="Water" plate="water" unit="ml" limit={false} data={waterData} target={targetWater}
            note={`avg ${Math.round(waterAvg).toLocaleString("en-US")} of ${targetWater.toLocaleString("en-US")} ml`} />
        )}
        {hasCaff && (
          <DrinkStrip label="Caffeine" plate="caffeine" unit="mg" limit data={caffData} target={targetCaffeine}
            note={<>avg {Math.round(caffAvg)} of {targetCaffeine} mg{caffAvg > targetCaffeine && <span className="ml-1.5 font-semibold text-alert">over</span>}</>} />
        )}
      </div>
    </SectionCard>
  );
}
