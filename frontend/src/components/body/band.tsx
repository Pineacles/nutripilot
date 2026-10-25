/** One ruled band of the Body page: a hairline above on phones, a flat panel from 768px. */
export function Band({ title, aside, children, className = "" }: {
  title?: string;
  /** A short summary figure, right of the title in g4. */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`clay-card py-5 md:p-5 ${className}`}>
      {title && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-medium text-ink">{title}</h2>
          {aside != null && <span className="text-[13px] tabular-nums text-g4">{aside}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

/** What a chart band says when it has nothing to draw: one line and where to fix it. */
export function BandEmpty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-[15px] text-g4">{children}</p>;
}
