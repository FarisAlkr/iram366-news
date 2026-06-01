import Image from 'next/image'
import Link from 'next/link'

import { relativeTime } from '@/lib/date'
import type { Article, Category, Media } from '@/types/payload'
import { resolveRef, pickMediaUrl } from '@/types/payload'
import { CategoryBadge } from './CategoryBadge'

interface HeroProps {
  main: Article
  secondary: Article[]
}

export function HeroSection({ main, secondary }: HeroProps) {
  const mainImage = resolveRef<Media>(main.featuredImage ?? null)
  const mainCategory = resolveRef<Category>(main.category ?? null)

  return (
    <section className="container-news py-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Link href={`/articles/${main.slug}`} className="group relative block lg:col-span-2">
          <article className="relative overflow-hidden rounded-lg bg-surface shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)] lg:bg-transparent lg:shadow-none lg:hover:translate-y-0 lg:hover:shadow-none">
            <div className="relative aspect-[16/9] overflow-hidden lg:aspect-[2/1]">
              {mainImage && (
                <Image
                  src={pickMediaUrl(mainImage, 'hero')}
                  alt={mainImage.alt || main.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  priority
                  sizes="(max-width: 1024px) 100vw, 66vw"
                />
              )}
              {/* Gradient overlay — desktop only; on mobile the text sits below the image. */}
              <div className="absolute inset-0 hidden bg-gradient-to-t from-black/80 via-black/30 to-transparent lg:block" />
              {/* Mobile: badge overlays the image corner (matches ArticleCard default). */}
              {mainCategory && (
                <div className="absolute start-3 top-3 lg:hidden">
                  <CategoryBadge
                    name={mainCategory.name}
                    slug={mainCategory.slug}
                    color={mainCategory.color}
                  />
                </div>
              )}
            </div>
            <div className="p-4 lg:absolute lg:inset-x-0 lg:bottom-0 lg:p-8">
              {/* Desktop: badge sits inline above the title in the overlay. */}
              {mainCategory && (
                <div className="hidden lg:block">
                  <CategoryBadge
                    name={mainCategory.name}
                    slug={mainCategory.slug}
                    color={mainCategory.color}
                    size="md"
                  />
                </div>
              )}
              <h2 className="mb-2 text-balance font-display font-bold leading-snug text-[var(--font-size-card-title)] text-ink transition-colors duration-150 group-hover:text-accent-red lg:mt-3 lg:font-extrabold lg:leading-tight lg:text-[var(--font-size-hero)] lg:text-white lg:group-hover:text-white">
                {main.title}
              </h2>
              <p className="line-clamp-2 max-w-2xl text-sm leading-relaxed text-[var(--color-ink-light)] md:text-base lg:text-lg lg:text-white/80">
                {main.excerpt}
              </p>
              {main.publishedAt && (
                <time className="mt-2 block text-xs text-[var(--color-ink-muted)] lg:text-sm lg:text-white/50">
                  {relativeTime(main.publishedAt)}
                </time>
              )}
            </div>
          </article>
        </Link>

        <div className="flex flex-col gap-4">
          {secondary.map((article) => (
            <SecondaryHeroCard key={article.id} article={article} />
          ))}
        </div>
      </div>
    </section>
  )
}

function SecondaryHeroCard({ article }: { article: Article }) {
  const image = resolveRef<Media>(article.featuredImage ?? null)
  const cat = resolveRef<Category>(article.category ?? null)

  return (
    <Link href={`/articles/${article.slug}`} className="group relative block flex-1">
      <article className="relative h-full overflow-hidden rounded-lg bg-surface shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)] lg:min-h-[180px] lg:bg-transparent lg:shadow-none lg:hover:translate-y-0 lg:hover:shadow-none">
        <div className="relative aspect-[16/9] overflow-hidden lg:absolute lg:inset-0 lg:aspect-auto">
          {image && (
            <Image
              src={pickMediaUrl(image, 'card')}
              alt={image.alt || article.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              sizes="(max-width: 1024px) 100vw, 33vw"
            />
          )}
          {/* Gradient overlay — desktop only. */}
          <div className="absolute inset-0 hidden bg-gradient-to-t from-black/75 via-black/20 to-transparent lg:block" />
          {/* Mobile: badge in the image corner (matches ArticleCard default). */}
          {cat && (
            <div className="absolute start-3 top-3 lg:hidden">
              <CategoryBadge name={cat.name} slug={cat.slug} color={cat.color} />
            </div>
          )}
        </div>
        <div className="p-3 lg:absolute lg:inset-x-0 lg:bottom-0 lg:p-4">
          {/* Desktop: badge inline above title in the overlay. */}
          {cat && (
            <div className="hidden lg:block">
              <CategoryBadge name={cat.name} slug={cat.slug} color={cat.color} />
            </div>
          )}
          <h3 className="line-clamp-2 font-display text-[15px] font-bold leading-snug text-ink transition-colors duration-150 group-hover:text-accent-red lg:mt-2 lg:text-lg lg:text-white lg:group-hover:text-white">
            {article.title}
          </h3>
        </div>
      </article>
    </Link>
  )
}
