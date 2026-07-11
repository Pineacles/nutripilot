import { fmt } from "@/lib/utils";
import { CHART_COLORS } from "@/lib/chart-theme";

interface Props {
  currentWeight: number | null;
  weightChange: number | null;
  currentBf: number | null;
  currentFatKg: number | null;
  fatKgChange: number | null;
  currentMuscle: number | null;
  currentMuscleKg: number | null;
  muscleKgChange: number | null;
  bmi: number | null;
  weeklyAvgChange: number | null;
}

export function HeroStats({
  currentWeight, weightChange, currentBf, currentFatKg, fatKgChange,
  currentMuscle, currentMuscleKg, muscleKgChange, bmi, weeklyAvgChange,
}: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
      <div className="clay-card p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Weight</p>
        <p className="text-xl font-bold text-foreground">
          {currentWeight != null ? `${fmt(currentWeight)} kg` : "--"}
        </p>
      </div>
      <div className="clay-card p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Change</p>
        <p className={`text-xl font-bold ${weightChange != null && weightChange < 0 ? "text-green-400" : weightChange != null && weightChange > 0 ? "text-amber-400" : "text-foreground"}`}>
          {weightChange != null ? `${weightChange > 0 ? "+" : ""}${fmt(weightChange)} kg` : "--"}
        </p>
      </div>
      <div className="clay-card p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Body Fat</p>
        <p className="text-xl font-bold" style={{ color: CHART_COLORS.amber }}>
          {currentBf != null ? `${fmt(currentBf)}%` : "--"}
        </p>
        {currentFatKg != null && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{fmt(currentFatKg)} kg</p>
        )}
      </div>
      <div className="clay-card p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Fat Change</p>
        <p className={`text-xl font-bold ${fatKgChange != null && fatKgChange < 0 ? "text-green-400" : fatKgChange != null && fatKgChange > 0 ? "text-amber-400" : "text-foreground"}`}>
          {fatKgChange != null ? `${fatKgChange > 0 ? "+" : ""}${fmt(fatKgChange)} kg` : "--"}
        </p>
      </div>
      <div className="clay-card p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Muscle</p>
        <p className="text-xl font-bold" style={{ color: CHART_COLORS.blue }}>
          {currentMuscle != null ? `${fmt(currentMuscle)}%` : "--"}
        </p>
        {currentMuscleKg != null && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{fmt(currentMuscleKg)} kg</p>
        )}
      </div>
      <div className="clay-card p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Muscle Change</p>
        <p className={`text-xl font-bold ${muscleKgChange != null && muscleKgChange > 0 ? "text-green-400" : muscleKgChange != null && muscleKgChange < 0 ? "text-amber-400" : "text-foreground"}`}>
          {muscleKgChange != null ? `${muscleKgChange > 0 ? "+" : ""}${fmt(muscleKgChange)} kg` : "--"}
        </p>
      </div>
      <div className="clay-card p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">BMI</p>
        <p className="text-xl font-bold text-foreground">
          {bmi != null ? fmt(bmi) : "--"}
        </p>
      </div>
      <div className="clay-card p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Weekly Avg</p>
        <p className={`text-xl font-bold ${weeklyAvgChange != null && weeklyAvgChange < 0 ? "text-green-400" : weeklyAvgChange != null && weeklyAvgChange > 0 ? "text-amber-400" : "text-foreground"}`}>
          {weeklyAvgChange != null ? `${weeklyAvgChange > 0 ? "+" : ""}${fmt(weeklyAvgChange, 2)} kg/w` : "--"}
        </p>
      </div>
    </div>
  );
}
