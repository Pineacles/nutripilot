import { SectionCard } from "@/components/charts/section-card";
import { fmt } from "@/lib/utils";
import { CHART_COLORS } from "@/lib/chart-theme";
import type { BodyCompEntry } from "@/lib/types";

interface Props {
  targetWeight: number | null;
  targetBf: number | null;
  currentWeight: number | null;
  startingWeight: number | null;
  currentBf: number | null;
  validBf: BodyCompEntry[];
}

export function MilestonesCard({ targetWeight, targetBf, currentWeight, startingWeight, currentBf, validBf }: Props) {
  return (
    <SectionCard title="Milestones" span="lg:col-span-2">
      <div className="space-y-5">
        {/* Weight progress — hidden entirely when no goal weight is set */}
        {targetWeight == null ? (
          <p className="text-xs text-muted-foreground">No weight goal set — add one in Settings</p>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Weight</span>
              <span className="text-xs font-medium text-foreground">
                {currentWeight != null ? `${fmt(currentWeight)} kg` : "--"} / {targetWeight} kg
              </span>
            </div>
            {currentWeight != null && startingWeight != null ? (() => {
              const totalNeeded = startingWeight - targetWeight;
              const achieved = startingWeight - currentWeight;
              const pct = totalNeeded !== 0 ? Math.max(0, Math.min(100, Math.round((achieved / totalNeeded) * 100))) : 0;
              return (
                <>
                  <div className="w-full h-3 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${CHART_COLORS.green}, ${CHART_COLORS.greenLight})`,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{pct}% of goal reached</p>
                </>
              );
            })() : (
              <div className="w-full h-3 rounded-full bg-secondary" />
            )}
          </div>
        )}

        {/* Body fat progress — hidden entirely when no goal body fat % is set */}
        {targetBf == null ? (
          <p className="text-xs text-muted-foreground">No body fat goal set — add one in Settings</p>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Body Fat</span>
              <span className="text-xs font-medium text-foreground">
                {currentBf != null ? `${fmt(currentBf)}%` : "--"} / {targetBf}%
              </span>
            </div>
            {currentBf != null && validBf.length > 0 ? (() => {
              const startBf = validBf[0].body_fat_pct ?? currentBf;
              const totalNeeded = startBf - targetBf;
              const achieved = startBf - currentBf;
              const pct = totalNeeded !== 0 ? Math.max(0, Math.min(100, Math.round((achieved / totalNeeded) * 100))) : 0;
              return (
                <>
                  <div className="w-full h-3 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${CHART_COLORS.amber}, ${CHART_COLORS.orange})`,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{pct}% of goal reached</p>
                </>
              );
            })() : (
              <div className="w-full h-3 rounded-full bg-secondary" />
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
