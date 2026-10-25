import Link from "next/link";
import { Band } from "./band";
import { fmt } from "@/lib/utils";

interface Props {
  targetWeight: number | null;
  targetBf: number | null;
  currentWeight: number | null;
  /** Earliest weight on record (not limited to the chart period). */
  startingWeight: number | null;
  currentBf: number | null;
  /** Earliest body fat % on record. */
  startingBf: number | null;
}

/**
 * Progress from a fixed start toward a goal. "Reached" only once the goal is met or passed;
 * the percent is capped at 99 until then so the bar never claims done while still short.
 */
function goalProgress(start: number, current: number, target: number) {
  const dir = start >= target ? 1 : -1;
  const toGo = (current - target) * dir;
  if (toGo <= 0) return { reached: true, toGo: 0, pct: 100, span: Math.abs(start - target), done: Math.abs(start - target) };
  const span = (start - target) * dir;
  const pct = span > 0 ? Math.max(0, Math.min(99, Math.floor(((start - current) * dir / span) * 100))) : 0;
  return { reached: false, toGo, pct, span, done: Math.max(0, (start - current) * dir) };
}

function GoalProgress({ label, current, target, start, unit }: { label: string; current: number | null; target: number; start: number | null; unit: string }) {
  const p = current != null && start != null ? goalProgress(start, current, target) : null;
  const shown = (n: number) => `${fmt(n)}${unit === "%" ? "%" : ` ${unit}`}`;
  return (
    <div className="py-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] text-ink">{label}</span>
        <span className="text-[15px] tabular-nums text-ink">
          {current != null ? shown(current) : "--"} <span className="text-[12px] text-g4">goal {shown(target)}</span>
        </span>
      </div>
      {p ? (
        <>
          {/* Ink while on the way, --done once the goal is reached */}
          <div className="mt-3 h-[3px] w-full bg-g2" role="img" aria-label={p.reached ? "Goal reached" : `${p.pct}% of the way to the goal`}>
            <div className={`animate-bar h-full ${p.reached ? "bg-done" : "bg-ink"}`} style={{ width: `${p.reached ? 100 : p.pct}%` }} />
          </div>
          <p className={`mt-2 text-[12px] ${p.reached ? "text-done" : "text-g4"}`}>
            {p.reached ? "Goal reached" : `${fmt(p.toGo)} ${unit} to go, ${p.pct}% of the way`}
          </p>
        </>
      ) : (
        <p className="mt-2 text-[12px] text-g4">Log a measurement to see the way to your goal.</p>
      )}
    </div>
  );
}

function NoGoal({ what }: { what: string }) {
  return (
    <p className="py-4 text-[13px] text-g4">
      No {what} goal set. <Link href="/settings" className="text-ink underline underline-offset-4">Add one in Settings</Link>
    </p>
  );
}

export function MilestonesCard({ targetWeight, targetBf, currentWeight, startingWeight, currentBf, startingBf }: Props) {
  return (
    <Band title="Goals" className="lg:col-span-2">
      <div className="divide-y divide-g2 border-y border-g2">
        {targetWeight == null ? (
          <NoGoal what="weight" />
        ) : (
          <GoalProgress label="Weight" current={currentWeight} target={targetWeight} start={startingWeight} unit="kg" />
        )}
        {targetBf == null ? (
          <NoGoal what="body fat" />
        ) : (
          <GoalProgress label="Body fat" current={currentBf} target={targetBf} start={startingBf} unit="%" />
        )}
      </div>
    </Band>
  );
}
