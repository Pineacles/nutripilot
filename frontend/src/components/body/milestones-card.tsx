import { SectionCard } from "@/components/charts/section-card";
import { fmt } from "@/lib/utils";
import { CHART_COLORS } from "@/lib/chart-theme";

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
  if (toGo <= 0) return { reached: true, toGo: 0, pct: 100 };
  const span = (start - target) * dir;
  const pct = span > 0 ? Math.max(0, Math.min(99, Math.floor(((start - current) * dir / span) * 100))) : 0;
  return { reached: false, toGo, pct };
}

function GoalProgress({ start, current, target, unit, gradient }: { start: number; current: number; target: number; unit: string; gradient: string }) {
  const { reached, toGo, pct } = goalProgress(start, current, target);
  return (
    <>
      <div className="w-full h-3 rounded-full bg-secondary overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: gradient }} />
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">
        {reached ? "Goal reached" : `${fmt(toGo)} ${unit} to go (${pct}% of the way)`}
      </p>
    </>
  );
}

export function MilestonesCard({ targetWeight, targetBf, currentWeight, startingWeight, currentBf, startingBf }: Props) {
  return (
    <SectionCard title="Milestones" span="lg:col-span-2">
      <div className="space-y-5">
        {/* Weight progress: hidden entirely when no goal weight is set */}
        {targetWeight == null ? (
          <p className="text-xs text-muted-foreground">No weight goal set, add one in Settings</p>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Weight</span>
              <span className="text-xs font-medium text-foreground">
                {currentWeight != null ? `${fmt(currentWeight)} kg` : "--"} / {targetWeight} kg
              </span>
            </div>
            {currentWeight != null && startingWeight != null ? (
              <GoalProgress
                start={startingWeight}
                current={currentWeight}
                target={targetWeight}
                unit="kg"
                gradient={`linear-gradient(90deg, ${CHART_COLORS.green}, ${CHART_COLORS.greenLight})`}
              />
            ) : (
              <div className="w-full h-3 rounded-full bg-secondary" />
            )}
          </div>
        )}

        {/* Body fat progress: hidden entirely when no goal body fat % is set */}
        {targetBf == null ? (
          <p className="text-xs text-muted-foreground">No body fat goal set, add one in Settings</p>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Body Fat</span>
              <span className="text-xs font-medium text-foreground">
                {currentBf != null ? `${fmt(currentBf)}%` : "--"} / {targetBf}%
              </span>
            </div>
            {currentBf != null && startingBf != null ? (
              <GoalProgress
                start={startingBf}
                current={currentBf}
                target={targetBf}
                unit="%"
                gradient={`linear-gradient(90deg, ${CHART_COLORS.amber}, ${CHART_COLORS.orange})`}
              />
            ) : (
              <div className="w-full h-3 rounded-full bg-secondary" />
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
