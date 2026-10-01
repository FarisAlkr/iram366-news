import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'

import { ARTICLES_PER_PAGE, archivePageHref, parsePageNumber } from '@/lib/pagination'
import { getCategories, getSiteSettings, listPublishedArticles } from '@/lib/queries'

import { ArticleCard } from '@/components/ArticleCard'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { Pagination } from '@/components/Pagination'
import { SectionHeading } from '@/components/SectionHeading'

// Same cadence as the homepage (its page 1). Pages render on first request
// and are then served from the ISR cache; article mutations invalidate them
// via revalidateArticlesAfterChange.
export const revalidate = 60

interface PageProps {
  params: Promise<{ pageNumber: string }>
}

export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { pageNumber } = await params
  const page = parsePageNumber(pageNumber)
  if (!page) return { title: 'صفحة غير موجودة' }
  const formatted = page.toLocaleString('ar-EG')
  return {
    title: `آخر الأخبار — الصفحة ${formatted}`,
    description: `أرشيف أخبار إرم 366 الإخبارية — الصفحة ${formatted}: الأخبار الأقدم من رهط والنقب وكل الأقسام.`,
    alternates: { canonical: archivePageHref(page) },
  }
}

export default async function ArchivePage({ params }: PageProps) {
  const { pageNumber } = await params
  const page = parsePageNumber(pageNumber)
  if (!page) notFound()
  if (page === 1) permanentRedirect('/')

  const [siteSettings, categories, result] = await Promise.all([
    getSiteSettings(),
    getCategories(),
    listPublishedArticles({ limit: ARTICLES_PER_PAGE, page }),
  ])

  // totalPages is 0 when the DB was unreachable — render the empty state
  // rather than caching a 404 for a page that normally exists.
  if (result.totalPages > 0 && page > result.totalPages) notFound()

  const siteName = siteSettings.siteName ?? 'إرم 366 الإخبارية'
  const navCategories = categories.map((c) => ({ name: c.name, slug: c.slug }))

  return (
    <>
      <Header siteName={siteName} categories={navCategories} logo={siteSettings.logo} />

      <main className="container-news py-8">
        <SectionHeading title="آخر الأخبار" />

        {result.docs.length === 0 ? (
          <p className="py-12 text-center text-lg text-[var(--color-ink-muted)]">
            لا توجد مقالات في هذه الصفحة حالياً
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {result.docs.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}

        <Pagination currentPage={page} totalPages={result.totalPages} hrefFor={archivePageHref} />
      </main>

      <Footer
        siteName={siteName}
        footerText={siteSettings.footerText}
        socialLinks={siteSettings.socialLinks}
        categories={navCategories}
        enableFooterCamel={siteSettings.signatureUi?.enableFooterCamel !== false}
      />
    </>
  )
}
