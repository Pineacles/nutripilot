import Link from "next/link";
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
  weeklyAvgChange: number | null;
}

/**
 * Progress from a fixed start toward a goal. "Reached" only once the goal is met or passed;
 * the percent is capped at 99 until then so the bar never claims done while still short.
 */
function goalProgress(start: number, current: number, target: number) {
  const dir = start >= target ? 1 : -1;
  const toGo = (current - target) * dir;
  if (toGo <= 0) return { reached: true, toGo: 0, pct: 100 };
  const span = (start - target) * dir;
  const pct = span > 0 ? Math.max(0, Math.min(99, Math.floor(((start - current) * dir / span) * 100))) : 0;
  return { reached: false, toGo, pct };
}

function GoalRow({ label, current, target, start, unit, note }: {
  label: string; current: number | null; target: number; start: number | null; unit: "kg" | "%"; note?: React.ReactNode;
}) {
  const p = current != null && start != null ? goalProgress(start, current, target) : null;
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
export function GoalRows({ targetWeight, targetBf, currentWeight, startingWeight, currentBf, startingBf, weeklyAvgChange }: Props) {
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
          label="Goal" current={currentWeight} target={targetWeight} start={startingWeight} unit="kg"
          note={awayFromGoal ? <p className="mt-2 text-[13px] font-medium text-alert">Moving away from your goal</p> : undefined}
        />
      )}
      {targetBf != null && (
        <GoalRow label="Body fat goal" current={currentBf} target={targetBf} start={startingBf} unit="%" />
      )}
    </div>
  );
}
