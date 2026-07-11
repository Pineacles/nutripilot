import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { SectionCard } from "@/components/charts/section-card";
import { TT_STYLE } from "./chart-tooltip";
import { fmt } from "@/lib/utils";

interface DonutEntry {
  name: string;
  value: number;
  color: string;
}

interface Props {
  compositionDonut: DonutEntry[];
}

export function CompositionDonutCard({ compositionDonut }: Props) {
  return (
    <SectionCard title="Current Composition">
      {compositionDonut.length > 0 ? (
        <div className="flex flex-col items-center">
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={compositionDonut}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {compositionDonut.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={TT_STYLE}
                formatter={(value: unknown, name: unknown) => [`${fmt(Number(value ?? 0))}%`, String(name ?? "")]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {compositionDonut.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-xs text-muted-foreground">{entry.name}</span>
                <span className="text-xs font-semibold text-foreground">{fmt(entry.value)}%</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-12 text-center">No composition data</p>
      )}
    </SectionCard>
  );
}
