/** A figure that just reached something: a 1px ink frame opens outward once around it. */
export function InkFrame({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <span className="relative inline-block">
      {children}
      {show && <span aria-hidden="true" className="pointer-events-none absolute -inset-x-2 -inset-y-1.5 border border-ink animate-ink-frame" />}
    </span>
  );
}
