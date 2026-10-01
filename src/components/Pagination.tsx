import Link from 'next/link'

import { paginationItems } from '@/lib/pagination'

interface PaginationProps {
  currentPage: number
  totalPages: number
  /** Builds the URL for a page number (page 1 is usually the unsuffixed path). */
  hrefFor: (page: number) => string
}

const formatNumber = (n: number) => n.toLocaleString('ar-EG')

const baseItem =
  'inline-flex h-9 min-w-9 items-center justify-center rounded px-2 text-sm font-medium sm:h-10 sm:min-w-10'
const idleItem = `${baseItem} bg-surface text-ink shadow-[var(--shadow-card)] transition-colors duration-150 hover:bg-cream-dark`

/**
 * Numbered pager shared by the homepage archive (/page/N) and category
 * pages. "Previous" points to newer articles, "next" to older ones — the
 * convention readers expect from news sites. Renders nothing for a single
 * page.
 */
export function Pagination({ currentPage, totalPages, hrefFor }: PaginationProps) {
  if (totalPages <= 1) return null
  const items = paginationItems(currentPage, totalPages)
  const hasPrev = currentPage > 1
  const hasNext = currentPage < totalPages

  return (
    <nav aria-label="التنقل بين الصفحات" className="mt-10">
      <ul className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
        <li>
          {hasPrev ? (
            <Link href={hrefFor(currentPage - 1)} rel="prev" className={idleItem}>
              <span aria-hidden>→</span>
              <span className="ms-1 hidden sm:inline">السابق</span>
              <span className="sr-only sm:hidden">الصفحة السابقة</span>
            </Link>
          ) : (
            <span className={`${baseItem} cursor-not-allowed opacity-40`} aria-hidden>
              →<span className="ms-1 hidden sm:inline">السابق</span>
            </span>
          )}
        </li>

        {items.map((item, i) =>
          item === 'gap' ? (
            <li key={`gap-${i}`} aria-hidden className="px-1 text-[var(--color-ink-muted)]">
              …
            </li>
          ) : (
            <li key={item}>
              {item === currentPage ? (
                <span aria-current="page" className={`${baseItem} bg-accent-red text-white`}>
                  {formatNumber(item)}
                </span>
              ) : (
                <Link
                  href={hrefFor(item)}
                  aria-label={`الصفحة ${formatNumber(item)}`}
                  className={idleItem}
                >
                  {formatNumber(item)}
                </Link>
              )}
            </li>
          ),
        )}

        <li>
          {hasNext ? (
            <Link href={hrefFor(currentPage + 1)} rel="next" className={idleItem}>
              <span className="me-1 hidden sm:inline">التالي</span>
              <span className="sr-only sm:hidden">الصفحة التالية</span>
              <span aria-hidden>←</span>
            </Link>
          ) : (
            <span className={`${baseItem} cursor-not-allowed opacity-40`} aria-hidden>
              <span className="me-1 hidden sm:inline">التالي</span>←
            </span>
          )}
        </li>
      </ul>
      <p className="mt-3 text-center text-xs text-[var(--color-ink-muted)]">
        الصفحة {formatNumber(currentPage)} من {formatNumber(totalPages)}
      </p>
    </nav>
  )
}
