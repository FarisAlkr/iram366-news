import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ArticleStatus } from '@/domain/enums'
import { formatDate } from '@/lib/date'
import { getPayloadClient } from '@/lib/payload'
import { getArticleBySlug, getCategories, getSiteSettings } from '@/lib/queries'
import type { Article, Category, Media, User } from '@/types/payload'
import { pickMediaUrl, resolveRef } from '@/types/payload'

import { ArticleCard } from '@/components/ArticleCard'
import { CategoryBadge } from '@/components/CategoryBadge'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { AdSlot } from '@/components/AdSlot'
import { ArticleGallery } from '@/components/ArticleGallery'
import { RichText } from '@/components/RichText'
import { ZoomControls } from '@/components/ZoomControls'
import { ShareButtons } from '@/components/ShareButtons'
import { VideoEmbed } from '@/components/VideoEmbed'
import { ViewCounter } from '@/components/ViewCounter'

export const revalidate = 120

// Draft previews live at `/preview/articles/[slug]?secret=…` (force-dynamic,
// own renderer). This route is published-only so it can be ISR-cached. Mixing
// `revalidate` with `searchParams` reading here threw DYNAMIC_SERVER_USAGE on
// every hit (PR aftermath of the audit-driven `force-dynamic` removal).
interface PageProps {
  params: Promise<{ slug: string }>
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) return { title: 'مقال غير موجود' }

  const image = resolveRef<Media>(article.featuredImage ?? null)
  const author = resolveRef<User>(article.author ?? null)
  const heroUrl = image ? pickMediaUrl(image, 'hero') : ''

  return {
    title: article.seoTitle || article.title,
    description: article.seoDescription || article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: 'article',
      publishedTime: article.publishedAt ?? undefined,
      authors: author?.name ? [author.name] : undefined,
      images: heroUrl ? [{ url: heroUrl, width: 1200, height: 630 }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.excerpt,
      images: heroUrl ? [heroUrl] : [],
    },
    other: article.publishedAt ? { 'article:published_time': article.publishedAt } : undefined,
  }
}

export async function generateStaticParams() {
  // Skip during `next build` — DATABASE_URL is intentionally not in the Docker
  // build context, so Payload init throws. Returning [] defers all rendering
  // to runtime, where revalidate=120 turns each requested slug into an ISR
  // cache entry on first hit.
  if (process.env.NEXT_PHASE === 'phase-production-build') return []
  try {
    const payload = await getPayloadClient()
    const articles = await payload.find({
      collection: 'articles',
      where: { status: { equals: ArticleStatus.Published } },
      limit: 50,
      sort: '-publishedAt',
      depth: 0,
    })
    return (articles.docs as unknown as Article[]).map((a) => ({ slug: a.slug }))
  } catch {
    return []
  }
}

async function fetchRelated(article: Article): Promise<Article[]> {
  const categoryRef = article.category
  const categoryId =
    typeof categoryRef === 'object' && categoryRef && 'id' in categoryRef
      ? categoryRef.id
      : (categoryRef as string | number | undefined)
  if (!categoryId) return []
  try {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'articles',
      where: {
        category: { equals: categoryId },
        status: { equals: ArticleStatus.Published },
        slug: { not_equals: article.slug },
      },
      limit: 4,
      sort: '-publishedAt',
      depth: 1,
    })
    return result.docs as unknown as Article[]
  } catch {
    return []
  }
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params

  const article = await getArticleBySlug(slug)
  if (!article) notFound()

  const [siteSettings, categories, related] = await Promise.all([
    getSiteSettings(),
    getCategories(),
    fetchRelated(article),
  ])

  const category = resolveRef<Category>(article.category ?? null)
  const author = resolveRef<User>(article.author ?? null)
  const authorAvatar = resolveRef<Media>(author?.avatar ?? null)
  const image = resolveRef<Media>(article.featuredImage ?? null)
  const heroUrl = image ? pickMediaUrl(image, 'hero') : ''
  const articleUrl = `${SITE_URL}/articles/${slug}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.excerpt,
    image: heroUrl,
    datePublished: article.publishedAt,
    author: { '@type': 'Person', name: author?.name || 'إرم 366' },
    publisher: { '@type': 'Organization', name: 'إرم 366 الإخبارية' },
  }

  const siteName = siteSettings.siteName ?? 'إرم 366 الإخبارية'

  return (
    <>
      <Header
        siteName={siteName}
        categories={categories.map((c) => ({ name: c.name, slug: c.slug }))}
        logo={siteSettings.logo}
      />

      <ViewCounter slug={slug} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="container-news py-6">
        <nav
          className="mb-6 flex items-center gap-2 text-sm text-[var(--color-ink-muted)]"
          aria-label="مسار التنقل"
        >
          <Link href="/" className="transition-colors duration-150 hover:text-accent-red">
            الرئيسية
          </Link>
          {category && (
            <>
              <span aria-hidden>/</span>
              <Link
                href={`/category/${category.slug}`}
                className="transition-colors duration-150 hover:text-accent-red"
              >
                {category.name}
              </Link>
            </>
          )}
          <span aria-hidden>/</span>
          <span className="line-clamp-1 text-ink">{article.title}</span>
        </nav>

        <article className="mx-auto max-w-[var(--content-width)]">
          <header className="mb-8">
            {category && (
              <div className="mb-3">
                <CategoryBadge
                  name={category.name}
                  slug={category.slug}
                  color={category.color}
                  size="md"
                />
              </div>
            )}

            <h1 className="mb-4 text-balance font-display font-extrabold leading-tight text-[var(--font-size-h1)] md:text-[2.5rem]">
              {article.title}
            </h1>

            <p className="mb-5 text-lg leading-relaxed text-[var(--color-ink-light)]">
              {article.excerpt}
            </p>

            <div className="flex flex-wrap items-center gap-4 border-b border-[var(--color-border)] pb-5 text-sm text-[var(--color-ink-muted)]">
              {author && (
                <div className="flex items-center gap-2">
                  {authorAvatar && (
                    <Image
                      src={pickMediaUrl(authorAvatar, 'thumbnail')}
                      alt={authorAvatar.alt || author.name}
                      width={32}
                      height={32}
                      className="rounded-full object-cover"
                    />
                  )}
                  <span className="font-medium text-ink">{author.name}</span>
                </div>
              )}
              {article.publishedAt && <time>{formatDate(article.publishedAt)}</time>}
            </div>
          </header>

          {article.videoUrl ? (
            <div className="mb-8">
              <VideoEmbed url={article.videoUrl} title={article.title} />
            </div>
          ) : (
            heroUrl &&
            image && (
              <figure className="-mx-4 mb-8 md:mx-0">
                <div className="relative aspect-[16/9] overflow-hidden rounded-lg">
                  <Image
                    src={heroUrl}
                    alt={image.alt || article.title}
                    fill
                    className="object-cover"
                    priority
                    sizes="(max-width: 768px) 100vw, 720px"
                  />
                </div>
                {image.caption && (
                  <figcaption className="mt-2 text-center text-sm text-[var(--color-ink-muted)]">
                    {image.caption}
                  </figcaption>
                )}
              </figure>
            )
          )}

          <div className="mb-6">
            <ShareButtons url={articleUrl} title={article.title} />
          </div>

          {/* Floating reader-zoom — fixed bottom-left so it's always reachable
              while reading, on both desktop and mobile. */}
          <ZoomControls />

          <div className="prose-zoomable prose prose-lg mb-8 max-w-none">
            <RichText content={article.body} />
          </div>

          {Array.isArray(article.gallery) && article.gallery.length > 0 && (
            <ArticleGallery items={article.gallery} />
          )}

          <div className="mb-8">
            <AdSlot
              placement="article-end"
              categoryId={
                typeof article.category === 'object' && article.category
                  ? article.category.id
                  : (article.category ?? undefined)
              }
            />
          </div>

          {article.tags && article.tags.length > 0 && (
            <div className="mb-8 flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-6">
              {article.tags.map((t) => (
                <Link
                  key={t.tag}
                  href={`/search?q=${encodeURIComponent(t.tag)}`}
                  className="rounded-full bg-cream-dark px-3 py-1 text-sm text-[var(--color-ink-light)] transition-colors duration-150 hover:bg-[var(--color-border)]"
                >
                  #{t.tag}
                </Link>
              ))}
            </div>
          )}

          {author && (
            <div className="mb-8 flex items-start gap-4 rounded-lg bg-cream-dark p-5">
              {authorAvatar && (
                <Image
                  src={pickMediaUrl(authorAvatar, 'thumbnail')}
                  alt={authorAvatar.alt || author.name}
                  width={56}
                  height={56}
                  className="flex-shrink-0 rounded-full object-cover"
                />
              )}
              <div>
                <h3 className="font-display text-base font-bold">{author.name}</h3>
                <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                  كاتب في إرم 366 الإخبارية
                </p>
              </div>
            </div>
          )}
        </article>

        {related.length > 0 && (
          <section className="mx-auto mt-12 max-w-[var(--max-width)]">
            <div className="mb-6 flex items-center gap-4">
              <div className="h-8 w-1 rounded-full bg-accent-red" />
              <h2 className="font-display font-bold text-[var(--font-size-h2)]">مقالات ذات صلة</h2>
              <div className="h-px flex-1 bg-[var(--color-border)]" />
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((a) => (
                <ArticleCard key={a.id} article={a} variant="compact" />
              ))}
            </div>
          </section>
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
