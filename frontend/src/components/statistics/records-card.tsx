import { SectionCard } from "@/components/charts/section-card";
import { fmtDate } from "@/lib/chart-utils";
import { POSTER } from "@/lib/chart-theme";
import { plateOf } from "@/lib/plates";
import type { StatsSummary } from "@/lib/types";
import { useTracked } from "@/hooks/use-tracked";

interface Props {
  data: StatsSummary;
}

/** Best and worst days as ruled rows. A value takes a plate ink only when it is that macro's own figure. */
export function RecordsCard({ data }: Props) {
  const { shows } = useTracked();
  const records = [
    {
      label: "Highest protein day",
      data: data.highest_protein_day,
      value: data.highest_protein_day ? `${Math.round(data.highest_protein_day.protein).toLocaleString("en-US")} g` : null,
      date: data.highest_protein_day?.date,
      ink: POSTER.protein,
      nutrient: "protein",
    },
    {
      label: "Lowest calorie day",
      data: data.lowest_calorie_day,
      value: data.lowest_calorie_day ? `${Math.round(data.lowest_calorie_day.kcal).toLocaleString("en-US")} kcal` : null,
      date: data.lowest_calorie_day?.date,
      ink: POSTER.ink,
    },
    {
      label: "Highest calorie day",
      data: data.highest_calorie_day,
      value: data.highest_calorie_day ? `${Math.round(data.highest_calorie_day.kcal).toLocaleString("en-US")} kcal` : null,
      date: data.highest_calorie_day?.date,
      ink: POSTER.ink,
    },
    {
      label: "Best fiber day",
      data: data.best_fiber_day,
      value: data.best_fiber_day ? `${Math.round(data.best_fiber_day.fiber).toLocaleString("en-US")} g` : null,
      date: data.best_fiber_day?.date,
      ink: plateOf("fiber"),
      nutrient: "fiber",
    },
  ].filter((r) => !("nutrient" in r) || shows(r.nutrient as string));

  return (
    <SectionCard title="Records">
      <ul className="divide-y divide-g2 border-t border-g2">
        {records.map((record) => (
          <li key={record.label} className="flex min-h-[60px] items-center justify-between gap-3 py-2">
            <div>
              <p className="text-[15px] text-ink">{record.label}</p>
              {record.date && <p className="text-[12px] tabular-nums text-g4">{fmtDate(record.date)}</p>}
            </div>
            {record.data && record.value ? (
              <span className="text-[17px] font-medium tabular-nums" style={{ color: record.ink }}>{record.value}</span>
            ) : (
              <span className="text-[13px] text-g4">No data yet</span>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
