"use client";

import { ComposedChart, Area, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceArea, ReferenceLine } from "recharts";
import { DailyTooltip } from "./chart-tooltip";
import { AXIS_TICK_PROPS, fmtAxisTick, fmtDateAxis, niceCeil, useChartMotion } from "@/lib/chart-utils";
import { POSTER_CURSOR_LINE, POSTER_TARGET_LINE, POSTER_X_AXIS, POSTER_Y_AXIS, activeDotOf } from "@/lib/chart-theme";
import { ALERT, plateOf, plateTint } from "@/lib/plates";

/**
 * How the target reads on the chart:
 * - goal: reach it; the zone is the target plus or minus 10%, a day well under it is "low" on hover.
 * - limit: stay under it; no zone, just the rule, and days over it turn --alert.
 * - range: aim at it from either side; zone is plus or minus 10%, days over it turn --alert.
 * - none: no target, no zone.
 */
export type TargetMode = "goal" | "limit" | "range" | "none";

interface Props {
  data: Record<string, number | string>[];
  rawKey: string;
  avgKey: string;
  /** Plate key (plateOf): protein, water, kcal ... */
  plate: string;
  unit: string;
  target: number;
  mode: TargetMode;
  height?: number;
  yWidth?: number;
}

/**
 * One nutrient's days as an answer: the 7-day average is a 2px line in the plate (over a soft tint
 * when the nutrient has a plate, none for ink), a goal or range target a faint zone with its 1px
 * rule (a limit is only the rule), and a day over a limit or range is an --alert dot. Daily dots in
 * the plate only show on short periods (up to 31 days); on longer ones they would be noise.
 */
export function TrendChart({ data, rawKey, avgKey, plate, unit, target, mode, height = 140, yWidth = 40 }: Props) {
  const motion = useChartMotion();
  const ink = plateOf(plate);
  const hasTarget = mode !== "none" && target > 0;
  const overOf = mode === "limit" || mode === "range";
  const zone: [number, number] | null = !hasTarget || mode === "limit" ? null : [target * 0.9, target * 1.1];
  const filled = ink !== plateOf("kcal");
  const dots = data.length <= 31;

  return (
    <ResponsiveContainer minWidth={0} width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
        <XAxis dataKey="date" {...POSTER_X_AXIS} {...AXIS_TICK_PROPS} tickFormatter={(v: string) => fmtDateAxis(v, data.length)} />
        <YAxis {...POSTER_Y_AXIS} width={yWidth} tickFormatter={fmtAxisTick} domain={[0, (max: number) => niceCeil(Math.max(max, hasTarget ? target * 1.1 : 0))]} />
        <Tooltip
          content={<DailyTooltip rawKey={rawKey} avgKey={avgKey} unit={unit} limit={overOf && hasTarget ? target : undefined} goal={mode === "goal" ? target : undefined} />}
          cursor={POSTER_CURSOR_LINE}
        />
        {zone && <ReferenceArea y1={zone[0]} y2={zone[1]} ifOverflow="hidden" fill={plateTint(plate, 10)} fillOpacity={1} stroke="none" />}
        {hasTarget && <ReferenceLine y={target} {...POSTER_TARGET_LINE} />}
        <Area type="monotone" dataKey={avgKey} name="7-day avg" stroke={ink} strokeWidth={2} fill={filled ? ink : "none"} fillOpacity={filled ? 0.14 : 0} dot={false} activeDot={activeDotOf(ink)} {...motion} />
        <Line
          type="monotone"
          dataKey={rawKey}
          name="Daily"
          stroke="transparent"
          strokeWidth={0}
          activeDot={false}
          legendType="none"
          dot={(p: { cx?: number; cy?: number; index?: number; payload?: Record<string, number | string> }) => {
            const over = overOf && hasTarget && Number(p.payload?.[rawKey]) > target;
            if (p.cx == null || p.cy == null || (!over && !dots)) return <g key={p.index} />;
            return <circle key={p.index} cx={p.cx} cy={p.cy} r={over ? 2.5 : 2} fill={over ? ALERT : ink} fillOpacity={over ? 1 : 0.55} />;
          }}
          {...motion}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
