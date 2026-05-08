export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ArticleStatus } from '@/domain/enums'
import { estimateReadTime, formatDate } from '@/lib/date'
import { getPayloadClient } from '@/lib/payload'
import {
  getArticleBySlug,
  getCategories,
  getSiteSettings,
} from '@/lib/queries'
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

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ preview?: string }>
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

function isPreviewRequest(previewParam: string | undefined): boolean {
  const secret = process.env.PAYLOAD_PREVIEW_SECRET
  return Boolean(secret && previewParam === secret)
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const { preview } = await searchParams
  const isPreview = isPreviewRequest(preview)
  const article = await getArticleBySlug(slug, { allowDraft: isPreview })
  if (!article) return { title: 'مقال غير موجود' }
  if (isPreview) {
    return {
      title: `معاينة: ${article.title}`,
      robots: { index: false, follow: false },
    }
  }

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
  const payload = await getPayloadClient()
  const categoryRef = article.category
  const categoryId =
    typeof categoryRef === 'object' && categoryRef && 'id' in categoryRef
      ? categoryRef.id
      : (categoryRef as string | number | undefined)
  if (!categoryId) return []
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
}

export default async function ArticlePage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const { preview } = await searchParams
  const isPreview = isPreviewRequest(preview)

  const article = await getArticleBySlug(slug, { allowDraft: isPreview })
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
  const readTime = estimateReadTime(article.excerpt || '')

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

      {isPreview ? (
        <div className="bg-accent-gold text-navy text-center text-sm font-bold py-2 px-4 sticky top-0 z-50">
          وضع المعاينة — هذه مسودة وقد تحتوي على تغييرات غير منشورة
        </div>
      ) : (
        <ViewCounter slug={slug} />
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="container-news py-6">
        <nav
          className="text-sm text-[var(--color-ink-muted)] mb-6 flex items-center gap-2"
          aria-label="مسار التنقل"
        >
          <Link href="/" className="hover:text-accent-red transition-colors duration-150">
            الرئيسية
          </Link>
          {category && (
            <>
              <span aria-hidden>/</span>
              <Link
                href={`/category/${category.slug}`}
                className="hover:text-accent-red transition-colors duration-150"
              >
                {category.name}
              </Link>
            </>
          )}
          <span aria-hidden>/</span>
          <span className="text-ink line-clamp-1">{article.title}</span>
        </nav>

        <article className="max-w-[var(--content-width)] mx-auto">
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

            <h1 className="font-display font-extrabold text-[var(--font-size-h1)] md:text-[2.5rem] leading-tight mb-4 text-balance">
              {article.title}
            </h1>

            <p className="text-lg text-[var(--color-ink-light)] leading-relaxed mb-5">
              {article.excerpt}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--color-ink-muted)] pb-5 border-b border-[var(--color-border)]">
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
              <span>{readTime} دقائق قراءة</span>
            </div>
          </header>

          {article.videoUrl ? (
            <div className="mb-8">
              <VideoEmbed url={article.videoUrl} title={article.title} />
            </div>
          ) : (
            heroUrl && image && (
              <figure className="mb-8 -mx-4 md:mx-0">
                <div className="relative aspect-[16/9] rounded-lg overflow-hidden">
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
                  <figcaption className="text-sm text-[var(--color-ink-muted)] mt-2 text-center">
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

          <div className="prose prose-lg max-w-none mb-8 prose-zoomable">
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
                  : article.category ?? undefined
              }
            />
          </div>

          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8 pt-6 border-t border-[var(--color-border)]">
              {article.tags.map((t) => (
                <Link
                  key={t.tag}
                  href={`/search?q=${encodeURIComponent(t.tag)}`}
                  className="px-3 py-1 bg-cream-dark text-sm text-[var(--color-ink-light)] rounded-full hover:bg-[var(--color-border)] transition-colors duration-150"
                >
                  #{t.tag}
                </Link>
              ))}
            </div>
          )}

          {author && (
            <div className="bg-cream-dark rounded-lg p-5 flex items-start gap-4 mb-8">
              {authorAvatar && (
                <Image
                  src={pickMediaUrl(authorAvatar, 'thumbnail')}
                  alt={authorAvatar.alt || author.name}
                  width={56}
                  height={56}
                  className="rounded-full object-cover flex-shrink-0"
                />
              )}
              <div>
                <h3 className="font-display font-bold text-base">{author.name}</h3>
                <p className="text-sm text-[var(--color-ink-muted)] mt-1">
                  كاتب في إرم 366 الإخبارية
                </p>
              </div>
            </div>
          )}
        </article>

        {related.length > 0 && (
          <section className="mt-12 max-w-[var(--max-width)] mx-auto">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-1 h-8 bg-accent-red rounded-full" />
              <h2 className="font-display font-bold text-[var(--font-size-h2)]">مقالات ذات صلة</h2>
              <div className="flex-1 h-px bg-[var(--color-border)]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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
      />
    </>
  )
}
