import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine,
} from "recharts";
import { Band, BandEmpty } from "./band";
import { ChartTooltip } from "./chart-tooltip";
import { AXIS_TICK_PROPS, dateTickFormatter } from "@/lib/chart-utils";
import { BODY_INK, BODY_QUIET, BODY_RULE, BODY_SOFT, BODY_TICK, MAX_DOT_POINTS, niceDomain, usePrefersReducedMotion } from "@/lib/body-chart-utils";
import { fmt } from "@/lib/utils";

type DataRow = Record<string, unknown>;

interface ChartProps {
  data: DataRow[];
  dataKey: string;
  avgKey: string;
  height: number;
  valueSuffix: string;
  /** Raw dots for every length (Weight); otherwise only for 30 points or fewer. */
  alwaysDots?: boolean;
  /** Only the Weight trend draws a goal rule. */
  referenceValue?: number | null;
  /** The line and dot colour; ink for weight, a plate for body fat and muscle. */
  color?: string;
  /** A small line under the chart, e.g. lowest and highest. */
  caption?: string;
}

/** The latest 7 day average of a series, or undefined when there is none. */
export function latestAvg(data: DataRow[], avgKey: string): number | undefined {
  return [...data].reverse().find((d) => typeof d[avgKey] === "number")?.[avgKey] as number | undefined;
}

/**
 * One shape for every trend: raw readings as small g4 dots, the 7 day average as an ink line,
 * the goal as a 1px g5 rule. Hairline guides only, ticks in g4 at 12px. The Y domain holds every
 * raw value, every average point and the goal.
 */
export function TrendChart({ data, dataKey, avgKey, height, valueSuffix, alwaysDots, referenceValue, color = BODY_INK }: ChartProps) {
  const still = usePrefersReducedMotion();
  const nice = niceDomain([
    ...data.map((d) => d[dataKey] as number | null | undefined),
    ...data.map((d) => d[avgKey] as number | null | undefined),
    referenceValue,
  ]);
  const points = data.filter((d) => d[dataKey] != null).length;
  const dots = alwaysDots || points <= MAX_DOT_POINTS;
  return (
    <ResponsiveContainer minWidth={0} width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={BODY_RULE} vertical={false} />
        <XAxis dataKey="date" tickFormatter={dateTickFormatter()} {...AXIS_TICK_PROPS} tick={BODY_TICK} axisLine={false} tickLine={false} tickMargin={8} />
        <YAxis domain={nice?.domain ?? ["auto", "auto"]} ticks={nice?.ticks} allowDataOverflow tick={BODY_TICK} axisLine={false} tickLine={false} width={36} tickFormatter={(v: number) => String(Math.round(v * 10) / 10)} />
        <Tooltip content={<ChartTooltip valueSuffix={valueSuffix} valueKey={avgKey} />} cursor={{ stroke: BODY_SOFT, strokeWidth: 1 }} />
        {referenceValue != null && (
          <ReferenceLine y={referenceValue} stroke={BODY_SOFT} strokeWidth={1} label={{ value: `Goal ${referenceValue}`, position: "insideTopRight", fill: BODY_SOFT, fontSize: 12 }} />
        )}
        <Line type="linear" dataKey={dataKey} stroke="none" dot={dots ? { r: 2, fill: color === BODY_INK ? BODY_QUIET : color, fillOpacity: color === BODY_INK ? 1 : 0.55, strokeWidth: 0 } : false} activeDot={false} connectNulls isAnimationActive={false} />
        <Line type="monotone" dataKey={avgKey} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: color, stroke: "var(--g1)", strokeWidth: 2 }} connectNulls isAnimationActive={!still} animationDuration={700} animationEasing="ease-out" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

interface Props extends ChartProps {
  title: string;
  span?: string;
  hasData: boolean;
  emptyMessage: string;
}

export function MetricTrendCard({ title, span, hasData, emptyMessage, caption, ...chart }: Props) {
  const latest = latestAvg(chart.data, chart.avgKey);
  return (
    <Band title={title} aside={latest != null ? `7-day avg ${fmt(latest)}${chart.valueSuffix}` : undefined} className={span}>
      {hasData ? (
        <>
          <TrendChart {...chart} />
          {caption && <p className="mt-2 text-[12px] tabular-nums text-g4">{caption}</p>}
        </>
      ) : (
        <BandEmpty>{emptyMessage}</BandEmpty>
      )}
    </Band>
  );
}
