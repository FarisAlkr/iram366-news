export function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-lg bg-surface shadow-[var(--shadow-card)]">
      <div className="skeleton aspect-[16/9]" />
      <div className="space-y-3 p-4">
        <div className="skeleton h-3 w-16" />
        <div className="skeleton h-5 w-full" />
        <div className="skeleton h-5 w-3/4" />
        <div className="skeleton h-3 w-full" />
        <div className="flex justify-between">
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-3 w-16" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonHero() {
  return (
    <div className="container-news py-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="skeleton aspect-[2/1] rounded-lg lg:col-span-2" />
        <div className="flex flex-col gap-4">
          <div className="skeleton min-h-[180px] flex-1 rounded-lg" />
          <div className="skeleton min-h-[180px] flex-1 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
