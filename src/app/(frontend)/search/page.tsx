import type { Metadata } from 'next'
import Link from 'next/link'

import { ArticleStatus } from '@/domain/enums'
import { getPayloadClient } from '@/lib/payload'
import { getCategories, getSiteSettings } from '@/lib/queries'
import { normalizeArabic } from '@/lib/slug'
import type { Article } from '@/types/payload'

import { ArticleCard } from '@/components/ArticleCard'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'

export const revalidate = 0

const MIN_QUERY_LEN = 2
const MAX_QUERY_LEN = 80
const RESULT_LIMIT = 20

interface PageProps {
  searchParams: Promise<{ q?: string }>
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams
  return { title: q ? `نتائج البحث: ${q}` : 'بحث' }
}

async function searchArticles(query: string): Promise<Article[]> {
  const trimmed = query.trim().slice(0, MAX_QUERY_LEN)
  if (trimmed.length < MIN_QUERY_LEN) return []

  const normalized = normalizeArabic(trimmed)
  const variants = normalized !== trimmed ? [trimmed, normalized] : [trimmed]

  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'articles',
    where: {
      and: [
        { status: { equals: ArticleStatus.Published } },
        {
          or: [
            ...variants.map((v) => ({ title: { contains: v } })),
            ...variants.map((v) => ({ excerpt: { contains: v } })),
          ],
        },
      ],
    },
    limit: RESULT_LIMIT,
    sort: '-publishedAt',
    depth: 2,
  })
  return result.docs as unknown as Article[]
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams

  const [siteSettings, categories, articles] = await Promise.all([
    getSiteSettings(),
    getCategories(),
    q ? searchArticles(q) : Promise.resolve<Article[]>([]),
  ])

  const siteName = siteSettings.siteName ?? 'إرم 366 الإخبارية'
  const trimmedQuery = q?.trim() ?? ''

  return (
    <>
      <Header
        siteName={siteName}
        categories={categories.map((c) => ({ name: c.name, slug: c.slug }))}
        logo={siteSettings.logo}
      />

      <main className="container-news py-8">
        <div className="max-w-2xl mb-8">
          <h1 className="font-display font-extrabold text-[var(--font-size-h1)] mb-4">بحث</h1>
          <form action="/search" method="GET">
            <input
              type="text"
              name="q"
              defaultValue={trimmedQuery}
              maxLength={MAX_QUERY_LEN}
              placeholder="ابحث في الأخبار..."
              className="w-full text-lg bg-white border border-[var(--color-border)] px-5 py-3 rounded-lg outline-none focus:border-accent-red transition-colors duration-150 font-body"
              dir="rtl"
              aria-label="بحث"
            />
          </form>
        </div>

        {trimmedQuery ? (
          articles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          ) : (
            <EmptyState query={trimmedQuery} categories={categories} />
          )
        ) : (
          <p className="text-center py-16 text-xl text-[var(--color-ink-muted)]">
            أدخل كلمات البحث للعثور على المقالات
          </p>
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

function EmptyState({
  query,
  categories,
}: {
  query: string
  categories: Array<{ slug: string; name: string }>
}) {
  return (
    <div className="text-center py-16">
      <p className="text-xl text-[var(--color-ink-muted)] mb-4">
        لم يتم العثور على نتائج لـ &quot;{query}&quot;
      </p>
      <p className="text-[var(--color-ink-muted)] mb-6">
        حاول البحث بكلمات مختلفة أو تصفح الأقسام
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {categories.map((cat) => (
          <Link
            key={cat.slug}
            href={`/category/${cat.slug}`}
            className="px-4 py-2 bg-white rounded-full text-sm font-medium shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-all duration-150"
          >
            {cat.name}
          </Link>
        ))}
      </div>
    </div>
  )
}
