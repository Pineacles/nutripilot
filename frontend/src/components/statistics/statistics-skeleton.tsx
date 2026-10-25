/** Loading shape of the statistics poster: chips, hero figure, one line, then ruled rows. */
export function StatisticsSkeleton() {
  return (
    <div role="status" aria-label="Loading statistics">
      <div className="mb-6 grid grid-cols-4 gap-2 sm:flex">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-11 rounded-full bg-g1 animate-pulse sm:w-14" />
        ))}
      </div>
      <div className="border-t border-g2">
        <div className="flex min-h-[172px] flex-col justify-end gap-3 py-5 min-[400px]:min-h-[196px] sm:min-h-[260px]">
          <div className="h-3 w-24 rounded-sm bg-g2 animate-pulse" />
          <div className="h-24 w-56 rounded-sm bg-g1 animate-pulse" />
        </div>
        <div className="border-y border-g2 py-3">
          <div className="h-3 w-32 rounded-sm bg-g2 animate-pulse" />
        </div>
      </div>
      <div className="mt-10 border-t border-g2 lg:grid lg:grid-cols-2 lg:gap-x-10">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex min-h-[64px] items-center justify-between gap-3 border-b border-g2 py-3">
            <div className="space-y-2">
              <div className="h-4 w-28 rounded-sm bg-g2 animate-pulse" />
              <div className="h-3 w-44 rounded-sm bg-g1 animate-pulse" />
            </div>
            <div className="h-6 w-[72px] rounded-sm bg-g1 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
