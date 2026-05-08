export function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg overflow-hidden shadow-[var(--shadow-card)]">
      <div className="aspect-[16/9] skeleton" />
      <div className="p-4 space-y-3">
        <div className="h-3 w-16 skeleton" />
        <div className="h-5 w-full skeleton" />
        <div className="h-5 w-3/4 skeleton" />
        <div className="h-3 w-full skeleton" />
        <div className="flex justify-between">
          <div className="h-3 w-20 skeleton" />
          <div className="h-3 w-16 skeleton" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonHero() {
  return (
    <div className="container-news py-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 aspect-[2/1] skeleton rounded-lg" />
        <div className="flex flex-col gap-4">
          <div className="flex-1 min-h-[180px] skeleton rounded-lg" />
          <div className="flex-1 min-h-[180px] skeleton rounded-lg" />
        </div>
      </div>
    </div>
  )
}
