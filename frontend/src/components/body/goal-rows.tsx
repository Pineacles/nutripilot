import Link from "next/link";
import { fmt } from "@/lib/utils";

interface Props {
  targetWeight: number | null;
  targetBf: number | null;
  currentWeight: number | null;
  /** Every weight on record (not limited to the chart period). */
  weightsOnRecord: number[];
  currentBf: number | null;
  /** Every body fat % on record. */
  bfOnRecord: number[];
  weeklyAvgChange: number | null;
}

/**
 * Progress toward a goal. The direction comes from where you are now (above the goal means
 * losing), never from the first entry: an old weigh-in below the goal must not turn a cut into
 * "reached". The start is the farthest value on record on that same side, so the bar shows how
 * much of the way is done. "Reached" only within `tolerance` of the goal.
 */
function goalProgress(onRecord: number[], current: number, target: number, tolerance: number) {
  const toGo = Math.abs(current - target);
  if (toGo <= tolerance) return { reached: true, toGo: 0, pct: 100 };
  const above = current > target;
  const start = onRecord.filter(v => (above ? v > target : v < target)).reduce((far, v) => (Math.abs(v - target) > Math.abs(far - target) ? v : far), current);
  const span = Math.abs(start - target);
  const pct = span > 0 ? Math.max(0, Math.min(99, Math.floor(((span - toGo) / span) * 100))) : 0;
  return { reached: false, toGo: Math.round(toGo * 10) / 10, pct };
}

function GoalRow({ label, current, target, onRecord, unit, note }: {
  label: string; current: number | null; target: number; onRecord: number[]; unit: "kg" | "%"; note?: React.ReactNode;
}) {
  const p = current != null ? goalProgress(onRecord, current, target, 0.3) : null;
  const goal = unit === "%" ? `${fmt(target)}%` : `${fmt(target)} kg`;
  const togo = p && !p.reached ? `${fmt(p.toGo)} ${unit === "%" ? "points" : "kg"} to go` : null;
  return (
    <div className="py-3.5">
      <p className="text-[15px] text-ink">
        {label} {goal}
        <span className={p?.reached ? "text-done" : "text-g4"}>
          {p ? (p.reached ? ": reached" : `: ${togo}`) : ": log a measurement to see the way"}
        </span>
      </p>
      {p && (
        <div className="mt-2.5 h-[3px] w-full bg-g2" role="img" aria-label={p.reached ? "Goal reached" : `${p.pct}% of the way to the goal`}>
          <div className={`animate-bar h-full ${p.reached ? "bg-done" : "bg-ink"}`} style={{ width: `${p.pct}%` }} />
        </div>
      )}
      {note}
    </div>
  );
}

/** The goals as ruled rows right under the weight: how far to go, and a word when drifting away. */
export function GoalRows({ targetWeight, targetBf, currentWeight, weightsOnRecord, currentBf, bfOnRecord, weeklyAvgChange }: Props) {
  // Away from the goal is said in a word with --alert, and only when it is notable (> 0.5 kg/week).
  const awayFromGoal =
    currentWeight != null && targetWeight != null && weeklyAvgChange != null &&
    (currentWeight > targetWeight ? weeklyAvgChange > 0.5 : currentWeight < targetWeight && weeklyAvgChange < -0.5);

  if (targetWeight == null && targetBf == null) {
    return (
      <p className="border-b border-g2 py-3.5 text-[13px] text-g4">
        No goal set. <Link href="/settings" className="text-ink underline underline-offset-4">Add one in Settings</Link>
      </p>
    );
  }
  return (
    <div className="divide-y divide-g2 border-b border-g2 tabular-nums">
      {targetWeight != null && (
        <GoalRow
          label="Goal" current={currentWeight} target={targetWeight} onRecord={weightsOnRecord} unit="kg"
          note={awayFromGoal ? <p className="mt-2 text-[13px] font-medium text-alert">Moving away from your goal</p> : undefined}
        />
      )}
      {targetBf != null && (
        <GoalRow label="Body fat goal" current={currentBf} target={targetBf} onRecord={bfOnRecord} unit="%" />
      )}
    </div>
  );
}
