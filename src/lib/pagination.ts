/**
 * Site-wide article archive pagination.
 *
 * Page 1 of the archive IS the homepage's "آخر الأخبار" list; older pages
 * live at /page/2, /page/3, … (path segments, not `?page=`, so each page
 * stays ISR-cacheable — reading searchParams would force dynamic rendering).
 * The homepage and the archive must use the same page size or the pages
 * would overlap / skip articles.
 */
export const ARTICLES_PER_PAGE = 12

export function archivePageHref(page: number): string {
  return page <= 1 ? '/' : `/page/${page}`
}

/** Parse a route segment into a page number ≥ 1, or null when it isn't one. */
export function parsePageNumber(raw: string | undefined): number | null {
  if (!raw || !/^\d{1,6}$/.test(raw)) return null
  const n = Number(raw)
  return n >= 1 ? n : null
}

export type PaginationItem = number | 'gap'

/**
 * Page numbers to render: always the first and last page, `siblings` pages
 * on each side of the current one, and a 'gap' marker for every elided run.
 * A gap that would hide exactly one page shows that page instead.
 */
export function paginationItems(current: number, total: number, siblings = 1): PaginationItem[] {
  if (total <= 1) return total === 1 ? [1] : []
  const page = Math.min(Math.max(current, 1), total)
  const start = Math.max(2, page - siblings)
  const end = Math.min(total - 1, page + siblings)

  const items: PaginationItem[] = [1]
  if (start === 3) items.push(2)
  else if (start > 3) items.push('gap')
  for (let p = start; p <= end; p++) items.push(p)
  if (end === total - 2) items.push(total - 1)
  else if (end < total - 2) items.push('gap')
  items.push(total)
  return items
}
