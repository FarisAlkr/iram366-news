import type { Metadata } from 'next'
import Link from 'next/link'
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

export const revalidate = 60

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
          <h1 className="font-display font-extrabold text-[var(--font-size-h1)] mb-2">
            {category.name}
          </h1>
          {category.description && (
            <p className="text-[var(--color-ink-light)] text-lg">{category.description}</p>
          )}
          <div
            className="h-1 w-16 bg-accent-red rounded-full mt-4"
            style={category.color ? { backgroundColor: category.color } : undefined}
          />
        </header>

        {articles.length === 0 ? (
          <p className="text-[var(--color-ink-muted)] text-lg py-12 text-center">
            لا توجد مقالات في هذا التصنيف حالياً
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} category={category} />
              ))}
            </div>

            {totalPages > 1 && (
              <Pagination slug={slug} totalPages={totalPages} currentPage={currentPage} />
            )}
          </>
        )}
      </main>

      <Footer
        siteName={siteName}
        footerText={siteSettings.footerText}
        socialLinks={siteSettings.socialLinks}
        categories={categories.map((c) => ({ name: c.name, slug: c.slug }))}
      />
    </>
  )
}

function Pagination({
  slug,
  totalPages,
  currentPage,
}: {
  slug: string
  totalPages: number
  currentPage: number
}) {
  return (
    <nav
      className="flex items-center justify-center gap-2 mt-10"
      aria-label="التنقل بين الصفحات"
    >
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
        const isCurrent = page === currentPage
        return (
          <Link
            key={page}
            href={`/category/${slug}?page=${page}`}
            aria-current={isCurrent ? 'page' : undefined}
            className={`w-10 h-10 flex items-center justify-center rounded text-sm font-medium transition-colors duration-150 ${
              isCurrent
                ? 'bg-accent-red text-white'
                : 'bg-white text-ink hover:bg-cream-dark shadow-[var(--shadow-card)]'
            }`}
          >
            {page.toLocaleString('ar-EG')}
          </Link>
        )
      })}
    </nav>
  )
}
