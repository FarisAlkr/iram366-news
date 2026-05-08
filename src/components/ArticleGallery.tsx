'use client'

import Image from 'next/image'
import React from 'react'

import type { GalleryImage, Media } from '@/types/payload'
import { pickMediaUrl, resolveRef } from '@/types/payload'

interface ArticleGalleryProps {
  items: GalleryImage[]
}

/**
 * Image grid for the optional `gallery` field on Articles. Click any image to
 * open a full-screen lightbox with caption + credit. Renders 2 columns on
 * mobile, 3 on tablet+, 4 on desktop. Hidden if no items.
 */
export const ArticleGallery: React.FC<ArticleGalleryProps> = ({ items }) => {
  const [openIdx, setOpenIdx] = React.useState<number | null>(null)

  const photos = React.useMemo(
    () =>
      items
        .map((g) => {
          const media = resolveRef<Media>(g.image)
          if (!media) return null
          return {
            url: pickMediaUrl(media, 'card'),
            full: pickMediaUrl(media, 'full'),
            alt: media.alt || g.caption || '',
            caption: g.caption ?? null,
            credit: g.credit ?? null,
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [items],
  )

  // Keyboard nav for the lightbox
  React.useEffect(() => {
    if (openIdx === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenIdx(null)
      if (e.key === 'ArrowRight') setOpenIdx((i) => (i === null ? null : (i + 1) % photos.length))
      if (e.key === 'ArrowLeft')
        setOpenIdx((i) => (i === null ? null : (i - 1 + photos.length) % photos.length))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openIdx, photos.length])

  if (photos.length === 0) return null

  const active = openIdx !== null ? photos[openIdx] : null

  return (
    <section className="article-gallery" aria-label="معرض الصور">
      <h3 className="article-gallery__heading">معرض الصور</h3>
      <div className="article-gallery__grid">
        {photos.map((p, i) => (
          <button
            type="button"
            key={i}
            className="article-gallery__tile"
            onClick={() => setOpenIdx(i)}
            aria-label={`فتح الصورة ${i + 1} من ${photos.length}`}
          >
            <Image
              src={p.url}
              alt={p.alt}
              width={600}
              height={400}
              className="article-gallery__img"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
            {(p.caption || p.credit) && (
              <span className="article-gallery__caption">
                {p.caption}
                {p.credit && (
                  <span className="article-gallery__credit"> — {p.credit}</span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>

      {active && (
        <div
          className="article-gallery__lightbox"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenIdx(null)}
        >
          <button
            type="button"
            className="article-gallery__close"
            onClick={() => setOpenIdx(null)}
            aria-label="إغلاق"
          >
            ✕
          </button>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                className="article-gallery__nav article-gallery__nav--prev"
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenIdx((i) => (i === null ? 0 : (i - 1 + photos.length) % photos.length))
                }}
                aria-label="السابق"
              >
                ‹
              </button>
              <button
                type="button"
                className="article-gallery__nav article-gallery__nav--next"
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenIdx((i) => (i === null ? 0 : (i + 1) % photos.length))
                }}
                aria-label="التالي"
              >
                ›
              </button>
            </>
          )}

          <figure
            className="article-gallery__figure"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={active.full}
              alt={active.alt}
              width={1920}
              height={1080}
              className="article-gallery__lightbox-img"
              priority
            />
            {(active.caption || active.credit) && (
              <figcaption className="article-gallery__lightbox-caption">
                {active.caption}
                {active.credit && (
                  <span className="article-gallery__lightbox-credit">
                    {' '}— {active.credit}
                  </span>
                )}
              </figcaption>
            )}
            {photos.length > 1 && (
              <span className="article-gallery__counter" dir="ltr">
                {(openIdx ?? 0) + 1} / {photos.length}
              </span>
            )}
          </figure>
        </div>
      )}
    </section>
  )
}

export default ArticleGallery
