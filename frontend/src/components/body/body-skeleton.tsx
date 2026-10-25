export function BodySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading body data" className="flex flex-col">
      <div className="flex items-center justify-between py-1">
        <div className="h-7 w-20 animate-pulse bg-g1" />
        <div className="h-11 w-24 animate-pulse rounded-full bg-g1" />
      </div>
      <div className="mt-4 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 w-12 animate-pulse rounded-full bg-g1" />
        ))}
      </div>
      <div className="mt-8 space-y-3 border-b border-g2 pb-6">
        <div className="h-3 w-16 animate-pulse bg-g2" />
        <div className="h-24 w-56 animate-pulse bg-g1" />
        <div className="h-4 w-40 animate-pulse bg-g2" />
      </div>
      <div className="grid grid-cols-3 divide-x divide-g2 border-b border-g2 py-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2 px-3 first:pl-0">
            <div className="h-3 w-10 animate-pulse bg-g2" />
            <div className="h-6 w-14 animate-pulse bg-g1" />
          </div>
        ))}
      </div>
      <div className="mt-6 h-56 animate-pulse bg-g1" />
      <div className="mt-6 space-y-px">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[60px] animate-pulse bg-g1" />
        ))}
      </div>
    </div>
  );
}
