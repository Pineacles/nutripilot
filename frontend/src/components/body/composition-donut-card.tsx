import { Band, BandEmpty } from "./band";
import { fmt } from "@/lib/utils";

interface DonutEntry {
  name: string;
  value: number;
  /** Ignored here: body metrics are drawn on the neutral ramp, the macro inks are for food. */
  color: string;
}

interface Props {
  compositionDonut: DonutEntry[];
}

// Body fat is not dietary fat, so none of the plate inks: ink, g5, g3 in that order.
const SHADES = ["var(--ink)", "var(--g5)", "var(--g3)"];

/** What the body is made of right now: one flat proportion bar with its parts as ruled rows. */
export function CompositionDonutCard({ compositionDonut }: Props) {
  return (
    <Band title="Current composition">
      {compositionDonut.length > 0 ? (
        <>
          <div className="flex h-2 gap-px" role="img" aria-label={compositionDonut.map((e) => `${e.name} ${fmt(e.value)}%`).join(", ")}>
            {compositionDonut.map((entry, i) => (
              <div key={entry.name} className="animate-bar h-full" style={{ width: `${entry.value}%`, background: SHADES[i % SHADES.length] }} />
            ))}
          </div>
          <ul className="mt-4 divide-y divide-g2 border-y border-g2">
            {compositionDonut.map((entry, i) => (
              <li key={entry.name} className="flex min-h-11 items-center gap-3 text-[15px]">
                <span className="h-2 w-2 shrink-0" style={{ background: SHADES[i % SHADES.length] }} />
                <span className="text-g5">{entry.name}</span>
                <span className="ml-auto tabular-nums text-ink">{fmt(entry.value)}%</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <BandEmpty>No body fat or muscle logged yet. Add a measurement with both to see the split.</BandEmpty>
      )}
    </Band>
  );
}
