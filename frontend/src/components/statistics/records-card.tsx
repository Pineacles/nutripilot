import { SectionCard } from "@/components/charts/section-card";
import { fmtDate } from "@/lib/chart-utils";
import { CHART_COLORS } from "@/lib/chart-theme";
import type { StatsSummary } from "@/lib/types";

interface Props {
  data: StatsSummary;
}

export function RecordsCard({ data }: Props) {
  const records = [
    {
      label: "Highest Protein Day",
      data: data.highest_protein_day,
      value: data.highest_protein_day ? `${data.highest_protein_day.protein}g` : null,
      date: data.highest_protein_day?.date,
      pill: "pill-blue",
      color: CHART_COLORS.blue,
    },
    {
      label: "Lowest Calorie Day",
      data: data.lowest_calorie_day,
      value: data.lowest_calorie_day ? `${data.lowest_calorie_day.kcal.toLocaleString()} kcal` : null,
      date: data.lowest_calorie_day?.date,
      pill: "pill-green",
      color: CHART_COLORS.green,
    },
    {
      label: "Highest Calorie Day",
      data: data.highest_calorie_day,
      value: data.highest_calorie_day ? `${data.highest_calorie_day.kcal.toLocaleString()} kcal` : null,
      date: data.highest_calorie_day?.date,
      pill: "pill-amber",
      color: CHART_COLORS.amber,
    },
    {
      label: "Best Fiber Day",
      data: data.best_fiber_day,
      value: data.best_fiber_day ? `${data.best_fiber_day.fiber}g` : null,
      date: data.best_fiber_day?.date,
      pill: "pill-green",
      color: CHART_COLORS.teal,
    },
    {
      label: "Longest Streak",
      data: true,
      value: `${data.current_streak} days`,
      date: null,
      pill: "pill-purple",
      color: CHART_COLORS.purple,
    },
  ];

  return (
    <SectionCard title="Personal Records">
      <div className="space-y-3">
        {records.map(record => (
          <div key={record.label} className={`pill ${record.pill} rounded-lg p-3`}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{record.label}</p>
            {record.data && record.value ? (
              <div className="flex items-baseline justify-between">
                <span className="text-base font-bold tabular-nums" style={{ color: record.color }}>
                  {record.value}
                </span>
                {record.date && (
                  <span className="text-[10px] text-muted-foreground/60">{fmtDate(record.date)}</span>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/50">--</p>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
