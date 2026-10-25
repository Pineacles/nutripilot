"use client";

import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip, Cell, LabelList } from "recharts";
import { SectionCard, SectionEmpty } from "@/components/charts/section-card";
import { POSTER_CURSOR_BAR, POSTER_TARGET_LINE, POSTER_X_AXIS } from "@/lib/chart-theme";
import { TT_STYLE } from "@/components/statistics/chart-tooltip";
import { countDays, daysWord, todayKey, useChartMotion } from "@/lib/chart-utils";
import { ALERT, plateOf } from "@/lib/plates";

interface Props {
  dailyAvgKcal: number;
  targetKcal: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={TT_STYLE}>
      <p style={{ color: "var(--g4)", fontSize: 12 }}>{d.long}</p>
      <p style={{ fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
        {Math.round(payload[0].value).toLocaleString("en-US")} kcal
        {d.over > 0 && <span style={{ color: "var(--alert)", marginLeft: 8, fontWeight: 600 }}>{d.over.toLocaleString("en-US")} over</span>}
      </p>
    </div>
  );
}

/** The day's figure set inside the foot of its bar, clear of the target rule; skipped when the bar is too short to hold it. */
function BarFigure({ x, y, width, height, value }: any) {
  if (!(Number(value) > 0) || height < 22) return null;
  return (
    <text x={x + width / 2} y={y + height - 8} textAnchor="middle" fill="var(--g0)" fontSize={12} style={{ fontVariantNumeric: "tabular-nums" }}>
      {/* A narrow phone bar holds "2.0k", not "2,047" */}
      {width < 46 ? `${(Number(value) / 1000).toFixed(1)}k` : Number(value).toLocaleString("en-US")}
    </text>
  );
}

/** Seven bars on one kcal scale, each labelled with its figure: calm g4 under target, today in full ink, a day over target filled --alert (and said "over" on hover and in the title). */
export function CalorieChartCard({ dailyAvgKcal, targetKcal, dailyData }: Props & { dailyData?: { date: string; kcal: number }[] }) {
  const router = useRouter();
  const motion = useChartMotion();
  const today = todayKey();

  const data = (dailyData ?? []).map((d) => ({
    day: new Date(d.date + "T00:00:00").toLocaleDateString("en", { weekday: "short" }),
    long: new Date(d.date + "T00:00:00").toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" }),
    dateStr: d.date,
    kcal: Math.round(d.kcal),
    isToday: d.date === today,
    over: Math.max(0, Math.round(d.kcal) - targetKcal),
  }));

  if (data.length === 0 || (dailyAvgKcal < 1 && data.every((d) => d.kcal === 0))) {
    return (
      <SectionCard title="Calories by day">
        <SectionEmpty>No calories logged this week. Log a meal on Today and it shows up here.</SectionEmpty>
      </SectionCard>
    );
  }

  const overDays = countDays(data.filter((d) => d.kcal > 0).map((d) => d.kcal), (v) => v > targetKcal).n;
  const title = overDays === 0 ? "Calories by day: never over target" : `Calories by day: over target on ${daysWord(overDays)}`;
  const max = Math.max(targetKcal, ...data.map((d) => d.kcal));
  return (
    <SectionCard title={title} summary={`target ${targetKcal.toLocaleString("en-US")}, tap a day to open it`}>
      <ResponsiveContainer minWidth={0} width="100%" height={240}>
        <BarChart data={data} barCategoryGap="22%" margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
          <XAxis dataKey="day" {...POSTER_X_AXIS} />
          <YAxis hide domain={[0, Math.ceil((max * 1.05) / 100) * 100]} />
          <Tooltip content={<CustomTooltip />} cursor={POSTER_CURSOR_BAR} />
          <ReferenceLine y={targetKcal} {...POSTER_TARGET_LINE} />
          <Bar
            dataKey="kcal"
            radius={0}
            cursor="pointer"
            {...motion}
            onClick={(_: unknown, index: number) => {
              const entry = data[index];
              if (entry?.dateStr) router.push(`/today?date=${entry.dateStr}`);
            }}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.over > 0 ? ALERT : entry.isToday ? plateOf("kcal") : "var(--g4)"} />
            ))}
            <LabelList dataKey="kcal" content={BarFigure} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}
