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
        <div className="mb-8 max-w-2xl">
          <h1 className="mb-4 font-display font-extrabold text-[var(--font-size-h1)]">بحث</h1>
          <form action="/search" method="GET">
            <input
              type="text"
              name="q"
              defaultValue={trimmedQuery}
              maxLength={MAX_QUERY_LEN}
              placeholder="ابحث في الأخبار..."
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-5 py-3 font-body text-lg outline-none transition-colors duration-150 focus:border-accent-red"
              dir="rtl"
              aria-label="بحث"
            />
          </form>
        </div>

        {trimmedQuery ? (
          articles.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          ) : (
            <EmptyState query={trimmedQuery} categories={categories} />
          )
        ) : (
          <p className="py-16 text-center text-xl text-[var(--color-ink-muted)]">
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
    <div className="py-16 text-center">
      <p className="mb-4 text-xl text-[var(--color-ink-muted)]">
        لم يتم العثور على نتائج لـ &quot;{query}&quot;
      </p>
      <p className="mb-6 text-[var(--color-ink-muted)]">حاول البحث بكلمات مختلفة أو تصفح الأقسام</p>
      <div className="flex flex-wrap justify-center gap-2">
        {categories.map((cat) => (
          <Link
            key={cat.slug}
            href={`/category/${cat.slug}`}
            className="rounded-full bg-white px-4 py-2 text-sm font-medium shadow-[var(--shadow-card)] transition-all duration-150 hover:shadow-[var(--shadow-card-hover)]"
          >
            {cat.name}
          </Link>
        ))}
      </div>
    </div>
  )
}
