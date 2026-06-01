import Image from 'next/image'
import Link from 'next/link'

import { relativeTime } from '@/lib/date'
import type { Article, Category, Media, User } from '@/types/payload'
import { resolveRef, pickMediaUrl } from '@/types/payload'
import { CategoryBadge } from './CategoryBadge'

type CardVariant = 'default' | 'compact' | 'horizontal'

interface ArticleCardProps {
  article: Pick<Article, 'title' | 'slug' | 'excerpt' | 'publishedAt'> & {
    featuredImage?: Article['featuredImage']
    category?: Article['category']
    author?: Article['author']
    videoUrl?: Article['videoUrl']
  }
  /** Override the card's category (e.g. category-page where category context is shared). */
  category?: Pick<Category, 'name' | 'slug' | 'color'>
  variant?: CardVariant
}

export function ArticleCard({ article, category, variant = 'default' }: ArticleCardProps) {
  const image = resolveRef<Media>(article.featuredImage ?? null)
  const cat = category ?? resolveRef<Category>(article.category ?? null)
  const author = resolveRef<User>(article.author ?? null)
  const imageAlt = image?.alt || article.title
  const href = `/articles/${article.slug}`
  const hasVideo = Boolean(article.videoUrl)

  if (variant === 'horizontal') {
    return (
      <Link href={href} className="iram-card-in group block">
        <article className="flex items-start gap-4">
          <div className="relative h-20 w-28 flex-shrink-0 overflow-hidden rounded">
            {image && (
              <Image
                src={pickMediaUrl(image, 'thumbnail')}
                alt={imageAlt}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="112px"
              />
            )}
            {hasVideo && <PlayBadge size="sm" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 font-display text-sm font-bold leading-relaxed transition-colors duration-150 group-hover:text-accent-red">
              {article.title}
            </h3>
            {article.publishedAt && (
              <time className="mt-1 block text-xs text-[var(--color-ink-muted)]">
                {relativeTime(article.publishedAt)}
              </time>
            )}
          </div>
        </article>
      </Link>
    )
  }

  if (variant === 'compact') {
    return (
      <Link href={href} className="iram-card-in group block">
        <article className="duration-250 overflow-hidden rounded bg-surface shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]">
          <div className="relative aspect-[3/2] overflow-hidden">
            {image && (
              <Image
                src={pickMediaUrl(image, 'card')}
                alt={imageAlt}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 768px) 50vw, 300px"
              />
            )}
            {cat && (
              <div className="absolute start-3 top-3">
                <CategoryBadge name={cat.name} slug={cat.slug} color={cat.color} />
              </div>
            )}
            {hasVideo && <PlayBadge />}
          </div>
          <div className="p-3">
            <h3 className="line-clamp-2 font-display text-[15px] font-bold leading-relaxed transition-colors duration-150 group-hover:text-accent-red">
              {article.title}
            </h3>
          </div>
        </article>
      </Link>
    )
  }

  return (
    <Link href={href} className="group block">
      <article className="duration-250 overflow-hidden rounded-lg bg-surface shadow-[var(--shadow-card)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]">
        <div className="relative aspect-[16/9] overflow-hidden">
          {image && (
            <Image
              src={pickMediaUrl(image, 'card')}
              alt={imageAlt}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          )}
          {cat && (
            <div className="absolute start-3 top-3">
              <CategoryBadge name={cat.name} slug={cat.slug} color={cat.color} />
            </div>
          )}
          {hasVideo && <PlayBadge />}
        </div>
        <div className="p-4">
          <h3 className="mb-2 line-clamp-2 font-display font-bold leading-snug text-[var(--font-size-card-title)] transition-colors duration-150 group-hover:text-accent-red">
            {article.title}
          </h3>
          <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-[var(--color-ink-light)]">
            {article.excerpt}
          </p>
          <div className="flex items-center justify-between text-xs text-[var(--color-ink-muted)]">
            {author?.name && <span>{author.name}</span>}
            {article.publishedAt && <time>{relativeTime(article.publishedAt)}</time>}
          </div>
        </div>
      </article>
    </Link>
  )
}

function PlayBadge({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-7 h-7' : 'w-12 h-12'
  const triangle =
    size === 'sm' ? 'border-y-[5px] border-s-[8px]' : 'border-y-[8px] border-s-[14px]'
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div
        className={`${dim} flex items-center justify-center rounded-full bg-black/55 shadow-md backdrop-blur-sm`}
      >
        <span
          className={`${triangle} ms-1 border-e-0 border-y-transparent border-s-white`}
          aria-hidden
        />
      </div>
    </div>
  )
}
