import type { MicronutrientAverages } from "@/lib/types";

export type MicroStatus = "low" | "enough" | "high" | "none";

/** A figure under this share of the target is "low". */
export const LOW_SHARE = 0.8;

/** Tolerable upper intake for the nutrients that have a known one (standard mg or µg units). Others never read "high". */
const UPPER: Partial<Record<keyof MicronutrientAverages, number>> = {
  vit_d: 100,
  calcium: 2500,
  iron: 45,
  zinc: 40,
  vit_c: 2000,
};

/** Low under 80% of the target, High only past a known upper limit, else Enough; no figure is "none". */
export function microStatus(key: keyof MicronutrientAverages, value: number | null | undefined, target: number): MicroStatus {
  if (value == null) return "none";
  const upper = UPPER[key];
  if (upper != null && value > Math.max(upper, target)) return "high";
  return target > 0 && value < target * LOW_SHARE ? "low" : "enough";
}

const RANK: Record<MicroStatus, number> = { low: 0, high: 1, enough: 2, none: 3 };

/** Low first, then High, then Enough; ties keep the given order. */
export function sortByStatus<T extends { status: MicroStatus }>(rows: T[]): T[] {
  return rows.map((r, i) => ({ r, i })).sort((a, b) => RANK[a.r.status] - RANK[b.r.status] || a.i - b.i).map((x) => x.r);
}

/** The headline for a group of nutrients: how many are low, or that all are enough. */
export function microHeadline(statuses: MicroStatus[]): string {
  const low = statuses.filter((s) => s === "low").length;
  const high = statuses.filter((s) => s === "high").length;
  if (statuses.every((s) => s === "none")) return "Vitamins and minerals";
  const parts: string[] = [];
  if (low > 0) parts.push(`${low} low`);
  if (high > 0) parts.push(`${high} high`);
  return `Vitamins and minerals: ${parts.length ? parts.join(", ") : "all enough"}`;
}

/** The status word: --alert and bold when it needs attention, quiet g5 when fine. Never colour alone. */
export function StatusWord({ status }: { status: MicroStatus }) {
  if (status === "none") return <span className="text-g4">No data</span>;
  const label = status === "low" ? "Low" : status === "high" ? "High" : "Enough";
  return <span className={status === "enough" ? "text-g5" : "font-semibold text-alert"}>{label}</span>;
}

/** A 3px scale bar to the value, with a tick at the target: --alert when Low or High, ink when Enough. */
export function MicroBar({ value, target, status, className = "" }: { value: number | null | undefined; target: number; status: MicroStatus; className?: string }) {
  const v = value ?? 0;
  const full = Math.max(1, target * 1.25, v);
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / full) * 100))}%`;
  const fill = status === "low" || status === "high" ? "var(--alert)" : "var(--ink)";
  return (
    <div className={`relative h-[3px] bg-g2 ${className}`} role="presentation">
      <div className="animate-bar absolute inset-y-0 left-0" style={{ width: pct(v), background: fill }} />
      {target > 0 && <div className="absolute -top-1 h-[11px] w-px bg-g5" style={{ left: pct(target) }} />}
    </div>
  );
}
