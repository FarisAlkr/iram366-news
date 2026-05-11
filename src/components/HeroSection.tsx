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
          <article className="relative aspect-[16/9] overflow-hidden rounded-lg lg:aspect-[2/1]">
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="absolute bottom-0 end-0 start-0 p-5 md:p-8">
              {mainCategory && (
                <CategoryBadge
                  name={mainCategory.name}
                  slug={mainCategory.slug}
                  color={mainCategory.color}
                  size="md"
                />
              )}
              <h2 className="mb-2 mt-3 text-balance font-display font-extrabold leading-tight text-[var(--font-size-hero)] text-white">
                {main.title}
              </h2>
              <p className="line-clamp-2 max-w-2xl text-base leading-relaxed text-white/80 md:text-lg">
                {main.excerpt}
              </p>
              {main.publishedAt && (
                <time className="mt-2 block text-sm text-white/50">
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
      <article className="relative h-full min-h-[180px] overflow-hidden rounded-lg">
        {image && (
          <Image
            src={pickMediaUrl(image, 'card')}
            alt={image.alt || article.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            sizes="(max-width: 1024px) 100vw, 33vw"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        <div className="absolute bottom-0 end-0 start-0 p-4">
          {cat && <CategoryBadge name={cat.name} slug={cat.slug} color={cat.color} />}
          <h3 className="mt-2 line-clamp-2 font-display text-base font-bold leading-snug text-white md:text-lg">
            {article.title}
          </h3>
        </div>
      </article>
    </Link>
  )
}
