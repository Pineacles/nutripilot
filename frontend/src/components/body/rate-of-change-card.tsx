import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";
import { Band, BandEmpty } from "./band";
import { ChartTooltip } from "./chart-tooltip";
import { AXIS_TICK_PROPS, dateTickFormatter } from "@/lib/chart-utils";
import { BODY_INK, BODY_RULE, BODY_SOFT, BODY_TICK, niceDomain, usePrefersReducedMotion } from "@/lib/body-chart-utils";
import { fmt } from "@/lib/utils";

interface Props {
  weeklyRateData: { date: string; rate: number }[];
  weeklyAvgChange: number | null;
}

export function RateOfChangeCard({ weeklyRateData, weeklyAvgChange }: Props) {
  const still = usePrefersReducedMotion();
  const nice = niceDomain([0, ...weeklyRateData.map((d) => d.rate)]);
  return (
    <Band
      title="Rate of change"
      aside={weeklyAvgChange != null ? `${weeklyAvgChange > 0 ? "+" : weeklyAvgChange < 0 ? "-" : ""}${fmt(Math.abs(weeklyAvgChange), 2)} kg/w` : undefined}
    >
      {weeklyRateData.length > 0 ? (
        <ResponsiveContainer minWidth={0} width="100%" height={140}>
          <LineChart data={weeklyRateData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={BODY_RULE} vertical={false} />
            <XAxis dataKey="date" tickFormatter={dateTickFormatter()} {...AXIS_TICK_PROPS} tick={BODY_TICK} axisLine={false} tickLine={false} tickMargin={8} />
            <YAxis domain={nice?.domain ?? ["auto", "auto"]} ticks={nice?.ticks} allowDataOverflow tick={BODY_TICK} axisLine={false} tickLine={false} width={36} />
            <Tooltip content={<ChartTooltip valueSuffix=" kg/w" valueKey="rate" />} cursor={{ stroke: BODY_SOFT, strokeWidth: 1 }} />
            <ReferenceLine y={0} stroke={BODY_SOFT} strokeWidth={1} />
            <Line type="monotone" dataKey="rate" stroke={BODY_INK} strokeWidth={2} dot={false} isAnimationActive={!still} animationDuration={700} animationEasing="ease-out" />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <BandEmpty>Needs 8 or more weigh-ins in the period. Pick a longer one.</BandEmpty>
      )}
    </Band>
  );
}
