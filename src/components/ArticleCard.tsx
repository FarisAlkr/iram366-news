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
        <article className="flex gap-4 items-start">
          <div className="relative w-28 h-20 flex-shrink-0 overflow-hidden rounded">
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
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-sm leading-relaxed line-clamp-2 group-hover:text-accent-red transition-colors duration-150">
              {article.title}
            </h3>
            {article.publishedAt && (
              <time className="text-[var(--color-ink-muted)] text-xs mt-1 block">
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
        <article className="bg-white rounded overflow-hidden shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-all duration-250 hover:-translate-y-0.5">
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
              <div className="absolute top-3 start-3">
                <CategoryBadge name={cat.name} slug={cat.slug} color={cat.color} />
              </div>
            )}
            {hasVideo && <PlayBadge />}
          </div>
          <div className="p-3">
            <h3 className="font-display font-bold text-[15px] leading-relaxed line-clamp-2 group-hover:text-accent-red transition-colors duration-150">
              {article.title}
            </h3>
          </div>
        </article>
      </Link>
    )
  }

  return (
    <Link href={href} className="group block">
      <article className="bg-white rounded-lg overflow-hidden shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-all duration-250 hover:-translate-y-1">
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
            <div className="absolute top-3 start-3">
              <CategoryBadge name={cat.name} slug={cat.slug} color={cat.color} />
            </div>
          )}
          {hasVideo && <PlayBadge />}
        </div>
        <div className="p-4">
          <h3 className="font-display font-bold text-[var(--font-size-card-title)] leading-snug line-clamp-2 mb-2 group-hover:text-accent-red transition-colors duration-150">
            {article.title}
          </h3>
          <p className="text-[var(--color-ink-light)] text-sm leading-relaxed line-clamp-2 mb-3">
            {article.excerpt}
          </p>
          <div className="flex items-center justify-between text-[var(--color-ink-muted)] text-xs">
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
  const triangle = size === 'sm' ? 'border-y-[5px] border-s-[8px]' : 'border-y-[8px] border-s-[14px]'
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className={`${dim} rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center shadow-md`}>
        <span
          className={`${triangle} border-y-transparent border-s-white border-e-0 ms-1`}
          aria-hidden
        />
      </div>
    </div>
  )
}
