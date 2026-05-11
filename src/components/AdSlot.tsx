'use client'

import React from 'react'

interface PublicAd {
  id: number | string
  headline?: string
  bodyText?: string
  ctaText?: string
  targetUrl: string
  sponsoredLabel: boolean
  image?: { url?: string; alt?: string } | null
  imageMobile?: { url?: string; alt?: string } | null
}

interface AdSlotProps {
  placement:
    | 'header-banner'
    | 'sidebar-top'
    | 'sidebar-bottom'
    | 'between-articles'
    | 'article-inline'
    | 'article-end'
    | 'footer'
  categoryId?: number | string
  className?: string
}

/**
 * Renders an active ad for the given placement. Fetches from /api/ads/active,
 * tracks impressions on first paint, and sends users through a tracked
 * /api/ads/:id/click redirect when they click. Hides itself if no active ads
 * — the layout collapses cleanly.
 */
export const AdSlot: React.FC<AdSlotProps> = ({ placement, categoryId, className }) => {
  const [ad, setAd] = React.useState<PublicAd | null>(null)
  const [hidden, setHidden] = React.useState(false)
  const trackedRef = React.useRef(false)

  React.useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ placement })
    if (categoryId !== undefined) params.set('category', String(categoryId))

    fetch(`/api/ads/active?${params.toString()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { ads?: PublicAd[] } | null) => {
        if (cancelled) return
        const first = j?.ads?.[0]
        if (first) setAd(first)
        else setHidden(true)
      })
      .catch(() => {
        if (!cancelled) setHidden(true)
      })

    return () => {
      cancelled = true
    }
  }, [placement, categoryId])

  // Fire impression once when the ad first becomes visible.
  React.useEffect(() => {
    if (!ad || trackedRef.current) return
    trackedRef.current = true
    fetch(`/api/ads/${ad.id}/impression`, {
      method: 'POST',
      keepalive: true,
    }).catch(() => null)
  }, [ad])

  if (hidden || !ad) return null

  const imgUrl = ad.image?.url
  const imgMobile = ad.imageMobile?.url || imgUrl
  const trackedHref = `/api/ads/${ad.id}/click`

  return (
    <aside className={`ad-slot ad-slot--${placement} ${className ?? ''}`} aria-label="إعلان">
      <a
        href={trackedHref}
        target="_blank"
        rel="sponsored noopener noreferrer"
        className="ad-slot__link"
      >
        {ad.sponsoredLabel && <span className="ad-slot__label">إعلان</span>}

        {imgUrl && (
          <picture className="ad-slot__media">
            {imgMobile && imgMobile !== imgUrl && (
              <source srcSet={imgMobile} media="(max-width: 640px)" />
            )}
            <img src={imgUrl} alt={ad.image?.alt || ad.headline || ''} />
          </picture>
        )}

        {(ad.headline || ad.bodyText || ad.ctaText) && (
          <div className="ad-slot__body">
            {ad.headline && <h3 className="ad-slot__headline">{ad.headline}</h3>}
            {ad.bodyText && <p className="ad-slot__text">{ad.bodyText}</p>}
            {ad.ctaText && <span className="ad-slot__cta">{ad.ctaText} ←</span>}
          </div>
        )}
      </a>
    </aside>
  )
}

export default AdSlot
