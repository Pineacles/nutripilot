"use client";

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { endLabel } from "./end-label";
import { SectionCard, SectionEmpty } from "@/components/charts/section-card";
import { MultiLineTooltip } from "./chart-tooltip";
import { AXIS_TICK_PROPS, dateTickFormatter, useChartMotion } from "@/lib/chart-utils";
import { POSTER, POSTER_ACTIVE_DOT, POSTER_CURSOR_LINE, POSTER_X_AXIS, POSTER_Y_AXIS } from "@/lib/chart-theme";
import { fmt } from "@/lib/utils";
import type { BodyCompEntry } from "@/lib/types";

interface Props {
  bodyCompData: BodyCompEntry[];
}

/** Body-fat/muscle % lines on the statistics page (distinct from the body page's own charts). */
export function BodyCompTrendCard({ bodyCompData }: Props) {
  const motion = useChartMotion();
  const last = (key: "body_fat_pct" | "muscle_mass_pct") => [...bodyCompData].reverse().find((d) => d[key] != null)?.[key] ?? null;
  // Past ~30 points raw dots fuse into a beaded line; the line alone reads cleaner
  const dotted = bodyCompData.length <= 30;
  const lastIndex = (key: "body_fat_pct" | "muscle_mass_pct") => bodyCompData.reduce((acc, d, i) => (d[key] != null ? i : acc), -1);
  const lastFat = lastIndex("body_fat_pct");
  const lastMuscle = lastIndex("muscle_mass_pct");
  const fat = last("body_fat_pct");
  const muscle = last("muscle_mass_pct");
  return (
    <SectionCard title={fat != null || muscle != null ? `Body composition: ${[fat != null ? `fat ${fmt(fat)}%` : null, muscle != null ? `muscle ${fmt(muscle)}%` : null].filter(Boolean).join(", ")}` : "Body composition"}>
      {bodyCompData.length === 0 ? (
        <SectionEmpty>No body fat or muscle recorded in this period.</SectionEmpty>
      ) : (
        <>
          {/* One axis (both are percent of body weight); the legend row sits above and each line is also named at its end */}
          <p className="-mt-2 mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] tabular-nums">
            <span className="flex items-center gap-1.5 text-ink"><span className="h-0.5 w-3 bg-ink" />Body fat</span>
            <span className="flex items-center gap-1.5 text-g5"><span className="h-0.5 w-3 bg-g5" />Muscle</span>
          </p>
          <ResponsiveContainer minWidth={0} width="100%" height={200}>
            <LineChart data={bodyCompData} margin={{ top: 8, right: 48, bottom: 0, left: 0 }}>
              <XAxis dataKey="date" {...POSTER_X_AXIS} tickFormatter={dateTickFormatter()} {...AXIS_TICK_PROPS} />
              <YAxis {...POSTER_Y_AXIS} width={32} domain={["auto", "auto"]} />
              <Tooltip content={<MultiLineTooltip />} cursor={POSTER_CURSOR_LINE} />
              <Line type="monotone" dataKey="body_fat_pct" name="Body fat %" stroke={POSTER.ink} strokeWidth={2} dot={dotted ? { r: 2, fill: POSTER.ink, strokeWidth: 0 } : false} activeDot={POSTER_ACTIVE_DOT} connectNulls label={endLabel("Fat", POSTER.ink, lastFat)} {...motion} />
              <Line type="monotone" dataKey="muscle_mass_pct" name="Muscle %" stroke={POSTER.quiet} strokeWidth={2} dot={dotted ? { r: 2, fill: POSTER.quiet, strokeWidth: 0 } : false} activeDot={POSTER_ACTIVE_DOT} connectNulls label={endLabel("Muscle", POSTER.quiet, lastMuscle)} {...motion} />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </SectionCard>
  );
}
