import { fmt } from "@/lib/utils";
import { plateOf } from "@/lib/plates";
import { signed } from "./hero-stats";

function Cell({ plate, label, value, change, days }: { plate: string; label: string; value: number | null; change: number | null; days: number }) {
  return (
    <div className="min-w-0 px-4 py-3.5 first:pl-0">
      <p className="flex items-center gap-2 text-[12px] text-g4">
        <span className="h-2 w-2 shrink-0" style={{ background: plateOf(plate) }} aria-hidden="true" />
        {label}
      </p>
      <p className="mt-0.5 text-[26px] font-medium leading-tight" style={{ color: value != null ? plateOf(plate) : "var(--g4)" }}>
        {value != null ? fmt(value) : "--"}
        {value != null && <span className="ml-0.5 text-[13px] font-normal text-g4">%</span>}
      </p>
      <p className="mt-0.5 text-[12px] text-g4">
        {value == null ? "Not logged" : change == null ? "No earlier reading" : `${signed(change)} pts in ${days === 365 ? "1 year" : `${days} days`}`}
      </p>
    </div>
  );
}

/** Body fat and muscle as one ruled two-cell row, each in its own plate with its change. */
export function CompositionPair({ bf, bfChange, muscle, muscleChange, days }: {
  bf: number | null; bfChange: number | null; muscle: number | null; muscleChange: number | null; days: number;
}) {
  return (
    <div className="grid grid-cols-2 divide-x divide-g2 border-b border-g2 tabular-nums">
      <Cell plate="bodyfat" label="Body fat" value={bf} change={bfChange} days={days} />
      <Cell plate="muscle" label="Muscle" value={muscle} change={muscleChange} days={days} />
    </div>
  );
}
