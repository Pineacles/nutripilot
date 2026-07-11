import { SectionCard } from "@/components/charts/section-card";
import { fmt } from "@/lib/utils";

interface Props {
  startingWeight: number | null;
  currentWeight: number | null;
  lowestWeight: number | null;
  highestWeight: number | null;
  weightChange: number | null;
  weeklyAvgChange: number | null;
}

export function WeightStatsCard({ startingWeight, currentWeight, lowestWeight, highestWeight, weightChange, weeklyAvgChange }: Props) {
  const stats = [
    { label: "Starting", value: startingWeight, unit: "kg", cls: "" },
    { label: "Current", value: currentWeight, unit: "kg", cls: "" },
    { label: "Lowest", value: lowestWeight, unit: "kg", cls: "text-green-400" },
    { label: "Highest", value: highestWeight, unit: "kg", cls: "text-amber-400" },
    { label: "Total Change", value: weightChange, unit: "kg", cls: weightChange != null && weightChange < 0 ? "text-green-400" : "text-amber-400" },
    { label: "Weekly Rate", value: weeklyAvgChange, unit: "kg/w", cls: weeklyAvgChange != null && weeklyAvgChange < 0 ? "text-green-400" : "text-amber-400" },
  ];

  return (
    <SectionCard title="Weight Stats">
      <div className="space-y-3">
        {stats.map((s) => (
          <div key={s.label} className="pill flex items-center justify-between px-3 py-2">
            <span className="text-xs text-muted-foreground">{s.label}</span>
            <span className={`text-sm font-semibold ${s.cls || "text-foreground"}`}>
              {s.value != null ? `${fmt(s.value, s.unit === "kg/w" ? 2 : 1)} ${s.unit}` : "--"}
            </span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
