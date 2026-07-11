export function StatisticsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-4">
        {[1, 2, 3, 4, 5, 6, 7].map(i => (
          <div key={i} className="h-9 w-12 rounded-full bg-muted animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="clay-card p-4 space-y-2">
            <div className="h-3 w-16 rounded bg-muted animate-pulse" />
            <div className="h-8 w-20 rounded bg-muted/50 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className={`clay-card p-5 space-y-3 ${i <= 2 ? "lg:col-span-2" : ""}`}>
            <div className="h-4 w-28 rounded bg-muted animate-pulse" />
            <div className="h-[200px] rounded-lg bg-muted/50 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
