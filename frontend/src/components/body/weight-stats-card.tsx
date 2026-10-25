import { Band } from "./band";
import { fmt } from "@/lib/utils";

interface Props {
  startingWeight: number | null;
  lowestWeight: number | null;
  highestWeight: number | null;
  weightChange: number | null;
  weeklyAvgChange: number | null;
}

const signed = (v: number, d: number) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${fmt(Math.abs(v), d)}`;

/** The period's weight facts as ruled rows: label left in g4, value right in ink. */
export function WeightStatsCard({ startingWeight, lowestWeight, highestWeight, weightChange, weeklyAvgChange }: Props) {
  const stats: { label: string; value: string | null }[] = [
    { label: "Starting", value: startingWeight != null ? `${fmt(startingWeight)} kg` : null },
    { label: "Lowest", value: lowestWeight != null ? `${fmt(lowestWeight)} kg` : null },
    { label: "Highest", value: highestWeight != null ? `${fmt(highestWeight)} kg` : null },
    { label: "Total change", value: weightChange != null ? `${signed(weightChange, 1)} kg` : null },
    { label: "Weekly rate", value: weeklyAvgChange != null ? `${signed(weeklyAvgChange, 2)} kg/w` : null },
  ];

  return (
    <Band title="Weight in this period">
      <ul className="divide-y divide-g2 border-y border-g2">
        {stats.map((s) => (
          <li key={s.label} className="flex min-h-11 items-center justify-between gap-3 text-[15px]">
            <span className="text-g4">{s.label}</span>
            <span className="tabular-nums text-ink">{s.value ?? "--"}</span>
          </li>
        ))}
      </ul>
    </Band>
  );
}
