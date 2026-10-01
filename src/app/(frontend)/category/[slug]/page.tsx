import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import {
  getCategories,
  getCategoryBySlug,
  getSiteSettings,
  listPublishedArticles,
} from '@/lib/queries'

import { ArticleCard } from '@/components/ArticleCard'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { Pagination } from '@/components/Pagination'

// Reads `?page=` from searchParams, which makes this route render per
// request regardless of any `revalidate` export — say so explicitly.
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 12

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}

function parsePage(raw: string | undefined): number {
  const n = parseInt(raw ?? '1', 10)
  return Number.isFinite(n) && n >= 1 ? n : 1
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const category = await getCategoryBySlug(slug)
  if (!category) return { title: 'تصنيف غير موجود' }
  return {
    title: `أخبار ${category.name}`,
    description: category.description || `آخر أخبار ${category.name} من إرم 366 الإخبارية`,
  }
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const { page: pageParam } = await searchParams
  const currentPage = parsePage(pageParam)

  const category = await getCategoryBySlug(slug)
  if (!category) notFound()

  const [siteSettings, categories, articlesResult] = await Promise.all([
    getSiteSettings(),
    getCategories(),
    listPublishedArticles({
      categoryId: category.id,
      limit: PAGE_SIZE,
      page: currentPage,
    }),
  ])

  const articles = articlesResult.docs
  const totalPages = articlesResult.totalPages
  const siteName = siteSettings.siteName ?? 'إرم 366 الإخبارية'

  return (
    <>
      <Header
        siteName={siteName}
        categories={categories.map((c) => ({ name: c.name, slug: c.slug }))}
        logo={siteSettings.logo}
      />

      <main className="container-news py-8">
        <header className="mb-8">
          <h1 className="mb-2 font-display font-extrabold text-[var(--font-size-h1)]">
            {category.name}
          </h1>
          {category.description && (
            <p className="text-lg text-[var(--color-ink-light)]">{category.description}</p>
          )}
          <div
            className="mt-4 h-1 w-16 rounded-full bg-accent-red"
            style={category.color ? { backgroundColor: category.color } : undefined}
          />
        </header>

        {articles.length === 0 ? (
          <p className="py-12 text-center text-lg text-[var(--color-ink-muted)]">
            لا توجد مقالات في هذا التصنيف حالياً
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} category={category} />
              ))}
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              hrefFor={(page) =>
                page <= 1 ? `/category/${slug}` : `/category/${slug}?page=${page}`
              }
            />
          </>
        )}
      </main>

      <Footer
        siteName={siteName}
        footerText={siteSettings.footerText}
        socialLinks={siteSettings.socialLinks}
        categories={categories.map((c) => ({ name: c.name, slug: c.slug }))}
        enableFooterCamel={siteSettings.signatureUi?.enableFooterCamel !== false}
      />
    </>
  )
}
