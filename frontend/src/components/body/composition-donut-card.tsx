import { Band, BandEmpty } from "./band";
import { fmt } from "@/lib/utils";

interface DonutEntry {
  name: string;
  value: number;
  color: string;
}

interface Props {
  compositionDonut: DonutEntry[];
  /** Shown as a small note under the rows. */
  bmi?: number | null;
}


/** What the body is made of right now: one flat proportion bar with its parts as ruled rows. */
export function CompositionDonutCard({ compositionDonut, bmi = null }: Props) {
  return (
    <Band title="Current composition">
      {compositionDonut.length > 0 ? (
        <>
          <div className="flex h-2 gap-px" role="img" aria-label={compositionDonut.map((e) => `${e.name} ${fmt(e.value)}%`).join(", ")}>
            {compositionDonut.map((entry) => (
              <div key={entry.name} className="animate-bar h-full" style={{ width: `${entry.value}%`, background: entry.color }} />
            ))}
          </div>
          <ul className="mt-4 divide-y divide-g2 border-y border-g2">
            {compositionDonut.map((entry) => (
              <li key={entry.name} className="flex min-h-11 items-center gap-3 text-[15px]">
                <span className="h-2 w-2 shrink-0" style={{ background: entry.color }} />
                <span className="text-g5">{entry.name}</span>
                <span className="ml-auto tabular-nums text-ink">{fmt(entry.value)}%</span>
              </li>
            ))}
          </ul>
          {bmi != null && <p className="mt-2 text-[12px] tabular-nums text-g5">BMI {fmt(bmi)}</p>}
        </>
      ) : (
        <BandEmpty>No body fat or muscle logged yet. Add a measurement with both to see the split.</BandEmpty>
      )}
    </Band>
  );
}
