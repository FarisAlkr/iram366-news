'use client'

import React from 'react'
import { useLivePreview } from '@payloadcms/live-preview-react'

import { CategoryBadge } from '@/components/CategoryBadge'
import { RichText } from '@/components/RichText'
import { formatDate } from '@/lib/date'
import { ArticleStatus } from '@/domain/enums'
import type { Article, Category, Media, User } from '@/types/payload'
import { resolveRef, pickMediaUrl } from '@/types/payload'

// Live-preview sends partial form state (the edit may be in flight, fields may
// be missing or contain a bare id rather than a populated object). We model
// that explicitly here rather than reaching for `any`.
type PartialArticle = Partial<Article>

interface Props {
  initialData: Article
  categories: Category[]
  serverURL: string
}

const STATUS_LABEL: Partial<Record<string, string>> = {
  [ArticleStatus.Draft]: 'مسودة',
  [ArticleStatus.InReview]: 'قيد المراجعة',
  [ArticleStatus.Archived]: 'مؤرشف',
}

function findCategory(
  ref: PartialArticle['category'],
  list: Category[],
): Category | undefined {
  const populated = resolveRef<Category>(ref ?? null)
  if (populated) return populated
  if (ref == null) return undefined
  return list.find((c) => String(c.id) === String(ref))
}

export const ArticleLivePreview: React.FC<Props> = ({
  initialData,
  categories,
  serverURL,
}) => {
  const { data, isLoading } = useLivePreview<PartialArticle>({
    initialData,
    serverURL,
    depth: 2,
  })

  const article = (data ?? initialData) as PartialArticle
  const category = findCategory(article.category, categories)
  const author = resolveRef<User>(article.author ?? null)
  const image = resolveRef<Media>(article.featuredImage ?? null)
  const heroUrl = image ? pickMediaUrl(image, 'hero') : ''
  const statusLabel =
    article.status && article.status !== ArticleStatus.Published
      ? STATUS_LABEL[article.status]
      : null

  return (
    <>
      <PreviewBanner isLoading={isLoading} />

      <main className="container-news py-6">
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
              {article.title || 'بدون عنوان'}
            </h1>

            {article.excerpt && (
              <p className="text-lg text-[var(--color-ink-light)] leading-relaxed mb-5">
                {article.excerpt}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--color-ink-muted)] pb-5 border-b border-[var(--color-border)]">
              {author?.name && <span className="font-medium text-ink">{author.name}</span>}
              {article.publishedAt && <time>{formatDate(article.publishedAt)}</time>}
              {statusLabel && (
                <span className="bg-amber-100 text-amber-700 px-3 py-0.5 rounded-full text-xs font-bold">
                  {statusLabel}
                </span>
              )}
            </div>
          </header>

          {heroUrl ? (
            <figure className="mb-8 -mx-4 md:mx-0">
              <div className="relative aspect-[16/9] rounded-lg overflow-hidden bg-[var(--color-border)]">
                {/* Plain <img>: live preview can show new uploads before the host is in next.config remotePatterns */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroUrl}
                  alt={image?.alt || article.title || ''}
                  className="w-full h-full object-cover"
                />
              </div>
              {image?.caption && (
                <figcaption className="text-sm text-[var(--color-ink-muted)] mt-2 text-center">
                  {image.caption}
                </figcaption>
              )}
            </figure>
          ) : (
            <div className="aspect-[16/9] flex items-center justify-center mb-8 rounded-lg border border-dashed border-[var(--color-border)] bg-gradient-to-br from-amber-100/30 to-navy-100/10 text-sm text-[var(--color-ink-muted)]">
              لم تُرفع صورة رئيسية بعد
            </div>
          )}

          <div className="prose prose-lg max-w-none mb-8">
            {article.body ? (
              <RichText content={article.body} />
            ) : (
              <p className="text-[var(--color-ink-muted)] italic">
                لم يُكتب محتوى المقال بعد...
              </p>
            )}
          </div>

          {Array.isArray(article.tags) && article.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8 pt-6 border-t border-[var(--color-border)]">
              {article.tags.map((t, i) => (
                <span
                  key={`${t.tag}-${i}`}
                  className="px-3 py-1 bg-cream-dark text-sm text-[var(--color-ink-light)] rounded-full"
                >
                  #{t.tag}
                </span>
              ))}
            </div>
          )}

          {(article.isBreaking || article.isFeatured) && (
            <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--color-border)]">
              {article.isBreaking && (
                <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">
                  🔴 خبر عاجل
                </span>
              )}
              {article.isFeatured && (
                <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold">
                  ⭐ مقال مميز
                </span>
              )}
            </div>
          )}
        </article>
      </main>
    </>
  )
}

function PreviewBanner({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="sticky top-0 z-[100] flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-bold bg-gradient-to-r from-[#c8a84e] to-[#9a7f34] text-[#0a2a2f] shadow-sm">
      <span className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            isLoading ? 'bg-amber-700 animate-pulse' : 'bg-emerald-600'
          }`}
        />
        <span>
          {isLoading
            ? 'يتم تحديث المعاينة...'
            : 'وضع المعاينة المباشرة — التغييرات تظهر فوراً أثناء الكتابة'}
        </span>
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="bg-black/10 border border-black/20 rounded-md px-3 py-1 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-black/15 transition-colors"
      >
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
        تحديث
      </button>
    </div>
  )
}
