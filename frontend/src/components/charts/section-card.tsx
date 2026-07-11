/** Shared clay-card wrapper used by every statistics/body chart card. */
export function SectionCard({ title, span = "", children, className = "" }: {
  title: string;
  span?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`clay-card p-5 ${span} ${className}`}>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}
