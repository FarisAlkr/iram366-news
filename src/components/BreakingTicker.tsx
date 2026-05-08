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
      className="bg-red-600 text-white overflow-hidden relative"
      role="region"
      aria-label="عاجل"
      aria-live="polite"
    >
      <div className="flex items-center h-11">
        <span className="bg-white text-red-700 px-4 md:px-5 py-1.5 text-base md:text-lg font-display font-extrabold flex-shrink-0 z-10 relative tracking-wide">
          عاجل
        </span>
        {/* Soft white separator between the badge and the scrolling headlines */}
        <span
          aria-hidden
          className="w-[2px] self-stretch bg-white/40 flex-shrink-0"
        />
        <div className="overflow-hidden flex-1 relative ps-3">
          <div className="animate-ticker whitespace-nowrap text-base font-semibold py-1">
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
          <Link
            href={`/articles/${article.slug}`}
            className="hover:underline underline-offset-2"
          >
            {article.title}
          </Link>
          {i < articles.length - 1 && <span className="mx-4 opacity-60">◆</span>}
        </span>
      ))}
    </span>
  )
}
