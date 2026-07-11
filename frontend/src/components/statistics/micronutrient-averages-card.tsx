import { SectionCard } from "@/components/charts/section-card";
import { fmt } from "@/lib/utils";
import type { MicronutrientAverages } from "@/lib/types";

const MICROS: { key: keyof MicronutrientAverages; label: string; target: number; unit: string }[] = [
  { key: "vit_d", label: "Vitamin D", target: 100, unit: "µg" },
  { key: "zinc", label: "Zinc", target: 15, unit: "mg" },
  { key: "omega3", label: "Omega-3", target: 1000, unit: "mg" },
  { key: "magnesium", label: "Magnesium", target: 400, unit: "mg" },
  { key: "b12", label: "B12", target: 2.4, unit: "µg" },
  { key: "iron", label: "Iron", target: 18, unit: "mg" },
  { key: "calcium", label: "Calcium", target: 1000, unit: "mg" },
  { key: "vit_c", label: "Vitamin C", target: 90, unit: "mg" },
  { key: "potassium", label: "Potassium", target: 3500, unit: "mg" },
];

interface Props {
  microAvg: MicronutrientAverages | null | undefined;
}

export function MicronutrientAveragesCard({ microAvg }: Props) {
  return (
    <SectionCard title="Micronutrient Averages" span="lg:col-span-3">
      {!microAvg ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No micronutrient data</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {MICROS.map(micro => {
            const avg = microAvg[micro.key] ?? 0;
            const pct = micro.target > 0 ? Math.round((avg / micro.target) * 100) : 0;
            const barColor = pct >= 80 ? "from-green-500 to-green-400" : pct >= 40 ? "from-amber-500 to-amber-400" : "from-red-500 to-red-400";
            const badgeColor = pct >= 80 ? "bg-green-500/15 text-green-400" : pct >= 40 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400";
            return (
              <div key={micro.key} className="pill rounded-lg p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">{micro.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold tabular-nums text-foreground">
                      {typeof avg === "number" ? fmt(avg) : avg} {micro.unit}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">/ {micro.target} {micro.unit}</span>
                    <span className={`text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full ${badgeColor}`}>
                      {pct}%
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-muted/30 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-500`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
