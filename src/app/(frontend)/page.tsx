// `force-dynamic` because page.tsx queries Postgres at render time. Without
// it Next.js tries to statically prerender the homepage during `next build`,
// when the DB is not reachable from inside the Docker build context, and
// the build crashes with `cannot connect to Postgres`.
export const dynamic = 'force-dynamic'

import { ArticleStatus, HeroMode } from '@/domain/enums'
import { getPayloadClient } from '@/lib/payload'
import { getCategories, getSiteSettings, listPublishedArticles } from '@/lib/queries'
import type { Article, Category } from '@/types/payload'

import { AdSlot } from '@/components/AdSlot'
import { ArticleCard } from '@/components/ArticleCard'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { HeroSection } from '@/components/HeroSection'
import { SectionHeading } from '@/components/SectionHeading'
import { Sidebar } from '@/components/Sidebar'

export const revalidate = 60

const HERO_SECONDARY_LIMIT = 3

interface HeroSelection {
  main: Article | null
  secondary: Article[]
}

async function resolveHero(
  settings: Awaited<ReturnType<typeof getSiteSettings>>,
  featured: Article[],
  latest: Article[],
): Promise<HeroSelection> {
  const config = settings.homepageHero
  const fallbackMain = featured[0] ?? latest[0] ?? null
  const fallbackSecondary =
    featured.length > 1
      ? featured.slice(1, 1 + HERO_SECONDARY_LIMIT)
      : latest.slice(1, 1 + HERO_SECONDARY_LIMIT)

  if (config?.mode !== HeroMode.Manual || !config.mainArticle) {
    return { main: fallbackMain, secondary: fallbackSecondary }
  }

  const payload = await getPayloadClient()
  const hydrate = async (ref: unknown): Promise<Article | null> => {
    if (!ref) return null
    if (typeof ref === 'object' && 'id' in (ref as object)) return ref as Article
    try {
      const doc = await payload.findByID({
        collection: 'articles',
        id: ref as string | number,
        depth: 2,
      })
      return doc as unknown as Article
    } catch {
      return null
    }
  }

  const mainHydrated = await hydrate(config.mainArticle)
  const secondaryRaw = Array.isArray(config.secondaryArticles) ? config.secondaryArticles : []
  const secondaryHydrated = (
    await Promise.all(secondaryRaw.slice(0, HERO_SECONDARY_LIMIT).map(hydrate))
  ).filter((a): a is Article => a !== null)

  // Backfill from auto sources when admin selections are missing/unpublished
  const main = mainHydrated ?? fallbackMain
  if (secondaryHydrated.length >= HERO_SECONDARY_LIMIT) {
    return { main, secondary: secondaryHydrated }
  }
  const usedIds = new Set([main, ...secondaryHydrated].filter(Boolean).map((a) => a!.id))
  const backfillPool = featured.length > 1 ? featured.slice(1) : latest
  const backfill = backfillPool
    .filter((a) => !usedIds.has(a.id))
    .slice(0, HERO_SECONDARY_LIMIT - secondaryHydrated.length)
  return { main, secondary: [...secondaryHydrated, ...backfill] }
}

export default async function HomePage() {
  const payload = await getPayloadClient()

  const [siteSettings, categories, breakingResult, featuredResult, latestResult, mostReadResult] =
    await Promise.all([
      getSiteSettings(),
      getCategories(),
      listPublishedArticles({ isBreaking: true, limit: 5, depth: 0 }),
      listPublishedArticles({ isFeatured: true, limit: 4 }),
      listPublishedArticles({ limit: 12 }),
      listPublishedArticles({ limit: 5, sort: '-views', depth: 1 }),
    ])

  const hero = await resolveHero(siteSettings, featuredResult.docs, latestResult.docs)

  // Per-category latest — parallelized.
  const categoryArticles = await Promise.all(
    categories.map(async (cat: Category) => {
      const result = await payload.find({
        collection: 'articles',
        where: {
          category: { equals: cat.id },
          status: { equals: ArticleStatus.Published },
        },
        limit: 4,
        sort: '-publishedAt',
        depth: 1,
      })
      return { category: cat, articles: result.docs as unknown as Article[] }
    }),
  )

  const siteName = siteSettings.siteName ?? 'إرم 366 الإخبارية'

  return (
    <>
      <Header
        siteName={siteName}
        categories={categories.map((c) => ({ name: c.name, slug: c.slug }))}
        logo={siteSettings.logo}
        breakingArticles={breakingResult.docs.map((a) => ({
          title: a.title,
          slug: a.slug,
        }))}
      />

      <main>
        {hero.main && <HeroSection main={hero.main} secondary={hero.secondary} />}

        <div className="container-news py-2">
          <AdSlot placement="between-articles" />
        </div>

        <div className="container-news py-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
            <div>
              <SectionHeading title="آخر الأخبار" />
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {latestResult.docs.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            </div>

            <div className="hidden space-y-4 lg:block">
              <AdSlot placement="sidebar-top" />
              <Sidebar
                mostRead={mostReadResult.docs.map((a) => ({
                  title: a.title,
                  slug: a.slug,
                  featuredImage: a.featuredImage,
                  publishedAt: a.publishedAt,
                }))}
                socialLinks={siteSettings.socialLinks}
              />
              <AdSlot placement="sidebar-bottom" />
            </div>
          </div>

          {/* Mobile-only ad break — surfaces sidebar-top so editors don't
              need a separate placement. The sidebar column above is
              hidden below the lg breakpoint, so its ads never reached
              phone readers; this puts one ad in the natural mobile
              flow without dragging in the social/most-read sidebar. */}
          <div className="mt-6 lg:hidden">
            <AdSlot placement="sidebar-top" />
          </div>
        </div>

        {(() => {
          const visibleCats = categoryArticles.filter((ca) => ca.articles.length > 0)
          const midIndex = Math.max(0, Math.floor(visibleCats.length / 2) - 1)
          return visibleCats.flatMap((ca, idx) => {
            const items = [
              <section key={ca.category.slug} className="container-news py-6">
                <SectionHeading title={ca.category.name} href={`/category/${ca.category.slug}`} />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {ca.articles.map((article) => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      category={ca.category}
                      variant="compact"
                    />
                  ))}
                </div>
              </section>,
            ]
            // Mobile-only ad break after the middle category section, so
            // sidebar-bottom (which the desktop sidebar column hides on
            // mobile) reaches phone readers without two ads stacking
            // adjacent to the footer ad.
            if (idx === midIndex && visibleCats.length > 1) {
              items.push(
                <div key={`ad-mid-${idx}`} className="container-news py-4 lg:hidden">
                  <AdSlot placement="sidebar-bottom" />
                </div>,
              )
            }
            return items
          })
        })()}

        <div className="container-news py-4">
          <AdSlot placement="footer" />
        </div>
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
