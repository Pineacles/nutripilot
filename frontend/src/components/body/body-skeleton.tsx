export function BodySkeleton() {
  return (
    <div className="space-y-6">
      <div className="clay-card p-5 h-12 animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="clay-card p-4 h-20 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="clay-card p-5 h-72 lg:col-span-2 animate-pulse" />
        <div className="clay-card p-5 h-72 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="clay-card p-5 h-64 animate-pulse" />
        ))}
      </div>
      <div className="clay-card p-5 h-72 animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="clay-card p-5 h-48 lg:col-span-2 animate-pulse" />
        <div className="clay-card p-5 h-48 animate-pulse" />
      </div>
    </div>
  );
}
