import Link from 'next/link'

interface BreakingArticle {
  title: string
  slug: string
}

interface BreakingTickerProps {
  articles: BreakingArticle[]
}

export function BreakingTicker({ articles }: BreakingTickerProps) {
  if (articles.length === 0) return null

  return (
    <div
      className="relative overflow-hidden bg-red-600 text-white"
      role="region"
      aria-label="عاجل"
      aria-live="polite"
    >
      <div className="flex h-11 items-center">
        <span className="relative z-10 flex-shrink-0 bg-white px-4 py-1.5 font-display text-base font-extrabold tracking-wide text-red-700 md:px-5 md:text-lg">
          عاجل
        </span>
        {/* Soft white separator between the badge and the scrolling headlines */}
        <span aria-hidden className="w-[2px] flex-shrink-0 self-stretch bg-white/40" />
        <div className="relative flex-1 overflow-hidden ps-3">
          <div className="animate-ticker whitespace-nowrap py-1 text-base font-semibold">
            <TickerRun articles={articles} />
            <TickerRun articles={articles} aria-hidden />
          </div>
        </div>
      </div>
    </div>
  )
}

function TickerRun({
  articles,
  ...rest
}: {
  articles: BreakingArticle[]
  'aria-hidden'?: boolean
}) {
  return (
    <span {...rest}>
      {articles.map((article, i) => (
        <span key={`${article.slug}-${i}`}>
          <Link href={`/articles/${article.slug}`} className="underline-offset-2 hover:underline">
            {article.title}
          </Link>
          {i < articles.length - 1 && <span className="mx-4 opacity-60">◆</span>}
        </span>
      ))}
    </span>
  )
}
