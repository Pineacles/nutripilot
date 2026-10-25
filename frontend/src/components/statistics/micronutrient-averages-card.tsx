import { SectionCard, SectionEmpty } from "@/components/charts/section-card";
import { MicroBar, StatusWord, microHeadline, microStatus, sortByStatus } from "./micro-status";
import { fmt } from "@/lib/utils";
import type { MicronutrientAverages } from "@/lib/types";
import { useTracked } from "@/hooks/use-tracked";

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

/** Daily averages against their targets, Low first: each row a name, a figure, a status word and a 3px bar. */
export function MicronutrientAveragesCard({ microAvg }: Props) {
  const { shows } = useTracked();
  const micros = MICROS.filter((m) => shows(m.key));
  if (micros.length === 0) return null;
  const rows = sortByStatus(micros.map((micro) => {
    const avg = microAvg?.[micro.key];
    return { micro, avg, status: microStatus(micro.key, avg, micro.target) };
  }));

  return (
    <SectionCard title={microAvg ? microHeadline(rows.map((r) => r.status)) : "Vitamins and minerals"} span="md:col-span-2" summary="daily average">
      {!microAvg ? (
        <SectionEmpty>No micronutrients logged in this period.</SectionEmpty>
      ) : (
        <ul className="grid border-t border-g2 md:grid-cols-2 md:gap-x-8">
          {rows.map(({ micro, avg, status }) => {
            const pct = avg != null && micro.target > 0 ? Math.round((avg / micro.target) * 100) : 0;
            return (
              <li key={micro.key} className="border-b border-g2 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px] text-ink">{micro.label}</span>
                  <span className="whitespace-nowrap tabular-nums">
                    <span className="text-[15px] font-medium text-ink">{avg != null ? fmt(avg) : "\u2014"}</span>
                    <span className="ml-1 text-[12px] text-g4">/ {micro.target} {micro.unit}</span>
                    <span className="ml-2 inline-block min-w-[3.25rem] text-right text-[12px]"><StatusWord status={status} />{status !== "none" && <span className="ml-1 text-g4">{pct}%</span>}</span>
                  </span>
                </div>
                <MicroBar className="mt-2.5" value={avg} target={micro.target} status={status} />
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
