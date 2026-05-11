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

function findCategory(ref: PartialArticle['category'], list: Category[]): Category | undefined {
  const populated = resolveRef<Category>(ref ?? null)
  if (populated) return populated
  if (ref == null) return undefined
  return list.find((c) => String(c.id) === String(ref))
}

export const ArticleLivePreview: React.FC<Props> = ({ initialData, categories, serverURL }) => {
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
              {article.title || 'بدون عنوان'}
            </h1>

            {article.excerpt && (
              <p className="mb-5 text-lg leading-relaxed text-[var(--color-ink-light)]">
                {article.excerpt}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 border-b border-[var(--color-border)] pb-5 text-sm text-[var(--color-ink-muted)]">
              {author?.name && <span className="font-medium text-ink">{author.name}</span>}
              {article.publishedAt && <time>{formatDate(article.publishedAt)}</time>}
              {statusLabel && (
                <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-bold text-amber-700">
                  {statusLabel}
                </span>
              )}
            </div>
          </header>

          {heroUrl ? (
            <figure className="-mx-4 mb-8 md:mx-0">
              <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-[var(--color-border)]">
                {/* Plain <img>: live preview can show new uploads before the host is in next.config remotePatterns */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroUrl}
                  alt={image?.alt || article.title || ''}
                  className="h-full w-full object-cover"
                />
              </div>
              {image?.caption && (
                <figcaption className="mt-2 text-center text-sm text-[var(--color-ink-muted)]">
                  {image.caption}
                </figcaption>
              )}
            </figure>
          ) : (
            <div className="to-navy-100/10 mb-8 flex aspect-[16/9] items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] bg-gradient-to-br from-amber-100/30 text-sm text-[var(--color-ink-muted)]">
              لم تُرفع صورة رئيسية بعد
            </div>
          )}

          <div className="prose prose-lg mb-8 max-w-none">
            {article.body ? (
              <RichText content={article.body} />
            ) : (
              <p className="italic text-[var(--color-ink-muted)]">لم يُكتب محتوى المقال بعد...</p>
            )}
          </div>

          {Array.isArray(article.tags) && article.tags.length > 0 && (
            <div className="mb-8 flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-6">
              {article.tags.map((t, i) => (
                <span
                  key={`${t.tag}-${i}`}
                  className="rounded-full bg-cream-dark px-3 py-1 text-sm text-[var(--color-ink-light)]"
                >
                  #{t.tag}
                </span>
              ))}
            </div>
          )}

          {(article.isBreaking || article.isFeatured) && (
            <div className="mt-4 flex gap-2 border-t border-[var(--color-border)] pt-4">
              {article.isBreaking && (
                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                  🔴 خبر عاجل
                </span>
              )}
              {article.isFeatured && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
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
    <div className="sticky top-0 z-[100] flex items-center justify-between gap-3 bg-gradient-to-r from-[#c8a84e] to-[#9a7f34] px-4 py-2.5 text-sm font-bold text-[#0a2a2f] shadow-sm">
      <span className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            isLoading ? 'animate-pulse bg-amber-700' : 'bg-emerald-600'
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
        className="inline-flex items-center gap-1.5 rounded-md border border-black/20 bg-black/10 px-3 py-1 text-xs font-bold transition-colors hover:bg-black/15"
      >
        <svg
          width={13}
          height={13}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
        تحديث
      </button>
    </div>
  )
}
