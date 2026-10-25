import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
} from "recharts";
import { Band, BandEmpty } from "./band";
import { MultiLineTooltip } from "./chart-tooltip";
import { AXIS_TICK_PROPS, dateTickFormatter } from "@/lib/chart-utils";
import { BODY_INK, BODY_QUIET, BODY_RULE, BODY_SOFT, BODY_TICK, niceDomain, usePrefersReducedMotion } from "@/lib/body-chart-utils";

type DataRow = Record<string, unknown>;

interface Props {
  enrichedData: DataRow[];
}

const SERIES = [
  { name: "Weight (kg, left)", key: "weight_kg_avg", axis: "weight", stroke: BODY_INK, dash: undefined },
  { name: "Body fat (%, right)", key: "body_fat_pct_avg", axis: "pct", stroke: BODY_SOFT, dash: undefined },
  { name: "Muscle (%, right)", key: "muscle_mass_pct_avg", axis: "pct", stroke: BODY_QUIET, dash: "4 3" },
];

export function ProgressOverviewCard({ enrichedData }: Props) {
  const still = usePrefersReducedMotion();
  const weightNice = niceDomain(enrichedData.map((d) => d.weight_kg_avg as number | null));
  const pctNice = niceDomain(enrichedData.flatMap((d) => [d.body_fat_pct_avg, d.muscle_mass_pct_avg] as (number | null)[]));
  return (
    <Band title="Everything together" className="hidden lg:col-span-3 lg:block">
      {enrichedData.length > 0 ? (
        <>
          <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-g4">
            {SERIES.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                <svg width="16" height="2" aria-hidden="true"><line x1="0" y1="1" x2="16" y2="1" stroke={s.stroke} strokeWidth="2" strokeDasharray={s.dash} /></svg>
                {s.name}
              </li>
            ))}
          </ul>
          <ResponsiveContainer minWidth={0} width="100%" height={260}>
            <ComposedChart data={enrichedData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={BODY_RULE} vertical={false} />
              <XAxis dataKey="date" tickFormatter={dateTickFormatter()} {...AXIS_TICK_PROPS} tick={BODY_TICK} axisLine={false} tickLine={false} tickMargin={8} />
              <YAxis yAxisId="weight" orientation="left" domain={weightNice?.domain ?? ["auto", "auto"]} ticks={weightNice?.ticks} allowDataOverflow tick={BODY_TICK} axisLine={false} tickLine={false} width={36} tickFormatter={(v: number) => String(Math.round(v))} />
              <YAxis yAxisId="pct" orientation="right" domain={pctNice?.domain ?? ["auto", "auto"]} ticks={pctNice?.ticks} allowDataOverflow tick={BODY_TICK} axisLine={false} tickLine={false} width={36} tickFormatter={(v: number) => String(Math.round(v))} />
              <Tooltip content={<MultiLineTooltip />} cursor={{ stroke: BODY_SOFT, strokeWidth: 1 }} />
              {SERIES.map((s) => (
                <Line key={s.key} yAxisId={s.axis} type="monotone" dataKey={s.key} name={s.name} stroke={s.stroke} strokeWidth={2} strokeDasharray={s.dash} dot={false} connectNulls isAnimationActive={!still} animationDuration={700} animationEasing="ease-out" />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </>
      ) : (
        <BandEmpty>No measurements in this period. Pick a longer period or add one.</BandEmpty>
      )}
    </Band>
  );
}
