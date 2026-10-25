/** Loading shape of the statistics poster: chips, hero figure, ruled facts, then chart bands. */
export function StatisticsSkeleton() {
  return (
    <div role="status" aria-label="Loading statistics">
      <div className="mb-6 grid grid-cols-7 gap-1 sm:flex sm:gap-2">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="h-11 rounded-full bg-g1 animate-pulse sm:w-14" />
        ))}
      </div>
      <div className="border-t border-g2">
        <div className="flex min-h-[172px] flex-col justify-end gap-3 py-5 min-[400px]:min-h-[196px] sm:min-h-[260px]">
          <div className="h-3 w-24 rounded-sm bg-g2 animate-pulse" />
          <div className="h-24 w-56 rounded-sm bg-g1 animate-pulse" />
        </div>
        <div className="grid grid-cols-3 divide-x divide-g2 border-y border-g2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2 px-3 py-3 first:pl-0">
              <div className="h-3 w-14 rounded-sm bg-g2 animate-pulse" />
              <div className="h-6 w-12 rounded-sm bg-g1 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`clay-card space-y-4 py-5 px-5 ${i === 1 ? "lg:col-span-2" : ""}`}>
            <div className="h-4 w-28 rounded-sm bg-g3/60 animate-pulse" />
            <div className="h-[200px] rounded-sm bg-g2 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
