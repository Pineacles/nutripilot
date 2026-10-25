/**
 * Shared section wrapper for the statistics, weekly and body pages. A ruled band on phones and a
 * quiet flat panel on wide screens (the `.clay-card` class does both). The heading is 15px medium
 * ink on the left; an optional summary figure sits in g4 on the same baseline on the right.
 */
export function SectionCard({ title, span = "", children, className = "", summary }: {
  title: string;
  span?: string;
  children: React.ReactNode;
  className?: string;
  /** A short figure for the right of the heading ("avg 2,134 kcal"). */
  summary?: React.ReactNode;
}) {
  return (
    <section className={`clay-card py-5 px-5 ${span} ${className}`}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-medium text-ink">{title}</h3>
        {summary != null && <p className="text-right text-[13px] tabular-nums text-g4">{summary}</p>}
      </div>
      {children}
    </section>
  );
}

/** The one empty-state line for a section: says what is missing and what to do. */
export function SectionEmpty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-[13px] text-g4">{children}</p>;
}

/**
 * A ruled section of cards: a small heading with its plate swatches (10px squares, one per plate
 * in the group, ink for mixed or plateless groups) above the first card's hairline, then a predictable grid that
 * reads left to right, top to bottom. Wide cards take `md:col-span-2` through SectionCard's span.
 */
export function SectionGroup({ title, swatches = ["var(--ink)"], children }: {
  title: string;
  swatches?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="mt-10 first:mt-0">
      <div className="mb-1 flex items-center gap-3">
        <span className="flex gap-0.5" aria-hidden="true">
          {swatches.map((ink, i) => <span key={i} className="h-3 w-3" style={{ background: ink }} />)}
        </span>
        <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </div>
  );
}
