'use client'

/**
 * Social-media hub: a floating cluster in the bottom-left corner that fans
 * platform icons outward on click. Mirrors the chatbot (bottom-right).
 *
 * Idle state — 72 px navy FAB with a sand border. Inside, five tiny
 * platform-branded circles arranged as a pentagon (Facebook top center,
 * WhatsApp upper-left, Instagram upper-right, TikTok lower-left,
 * Telegram lower-right), each carrying its own inline SVG glyph in
 * white. The cluster is fully representative of the open fan — same
 * five platforms in the same brand colors, just at thumbnail size.
 *
 * Open state — the FAB rotates 45° and the cluster fades to 35 %, so the
 * FAB visually reads as an "X" close affordance. Five full-size platform
 * icons (44 px circles, brand-colored, white SVG glyphs) fan up-and-right
 * along hand-tuned target positions to give the spread a natural arc that
 * feels more designed than a math-generated even arc would.
 *
 * Why hand-tuned positions: the canonical spec called for TikTok to fly
 * furthest up (visually anchoring the top of the spread) and Telegram to
 * arc past horizontal — that kind of asymmetric, slightly more dramatic
 * spread is hard to produce with a clean radial formula.
 *
 * URLs come from the existing socialLinks group on SiteSettings — the
 * admin already manages these from /admin. YouTube intentionally is NOT
 * surfaced here even though it has a CMS URL: this hub showcases the
 * publication's five primary social channels; YouTube continues to live
 * in the footer link list. Any of the five whose URL is empty / nullish
 * is filtered out (the pentagon cluster also adjusts — see below).
 *
 * Mounting is gated, in order:
 *  1. Env flag `NEXT_PUBLIC_FEATURE_SOCIAL_HUB` — only `=== 'false'`
 *     disables; otherwise default-on.
 *  2. Site setting `socialHub.enabled` — admin-flippable, default true.
 *  3. The `/admin` route is excluded by being in the (payload) route
 *     group, not (frontend).
 *
 * Reduced motion: animations collapse to instant show/hide. Coarse
 * pointer (touch): hover effects fall back gracefully but the hub
 * itself works fully on tap.
 */

import { useEffect, useId, useRef, useState } from 'react'

// --- Tunables --------------------------------------------------------------

const FAB_SIZE_PX = 72
const ICON_SIZE_PX = 44 // open-fan circle diameter
const MINI_SIZE_PX = 20 // pentagon-cluster circle diameter
const STAGGER_MS = 50
const ENTER_EASING = 'cubic-bezier(0.34, 1.56, 0.64, 1)' // overshoot bounce
const FAN_TRANSFORM_MS = 320
const FAN_OPACITY_MS = 200
const FAB_ROTATE_MS = 220

// --- Types -----------------------------------------------------------------

export interface SocialUrls {
  whatsapp?: string | null
  facebook?: string | null
  instagram?: string | null
  telegram?: string | null
  tiktok?: string | null
  // youtube is intentionally NOT in this type — the hub doesn't surface
  // it. The footer link list handles YouTube separately. Keeping the
  // type narrow is the simplest way to enforce that at compile time.
}

interface PlatformDef {
  key: keyof SocialUrls
  label: string // Arabic, for aria-label
  background: string // CSS background (color or gradient)
  svgPath: string // 24×24 viewBox SVG path
  // Pentagon-cluster placement (relative to the 72 px FAB box, top-left
  // origin). Inline CSS values; one of left/right is set, one of
  // top/bottom is set.
  mini: { top?: string; left?: string; right?: string; bottom?: string; zIndex: number }
  // Open-fan translation from the FAB center. Negative Y = up; positive
  // X = right of the FAB origin (which itself sits at the bottom-left
  // of the viewport — these translate the icons up-and-right into the
  // page area).
  fan: { x: number; y: number }
  // Stagger order on open. 0 enters first.
  order: number
}

// --- Platform definitions --------------------------------------------------
// SVG paths from simpleicons.org (public domain, brand-canonical glyphs).
// Note the explicit ordering: TikTok first (flies furthest, enters first
// — anchors the top of the spread), Telegram last (flies past horizontal,
// enters last). Keeps the spec's intent regardless of array order.

const PLATFORMS: PlatformDef[] = [
  {
    key: 'tiktok',
    label: 'تيك توك',
    background: '#000000',
    svgPath:
      'M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.1z',
    mini: { bottom: '8px', left: '18px', zIndex: 3 },
    fan: { x: 10, y: -130 },
    order: 0,
  },
  {
    key: 'whatsapp',
    label: 'واتساب',
    background: '#25D366',
    svgPath:
      'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z',
    mini: { top: '26px', left: '8px', zIndex: 4 },
    fan: { x: 10, y: -82 },
    order: 1,
  },
  {
    key: 'facebook',
    label: 'فيسبوك',
    background: '#1877F2',
    svgPath:
      'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
    mini: { top: '8px', left: '50%', zIndex: 5 },
    fan: { x: 56, y: -70 },
    order: 2,
  },
  {
    key: 'instagram',
    label: 'إنستغرام',
    background:
      'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
    svgPath:
      'M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.897 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.897-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z',
    mini: { top: '26px', right: '8px', zIndex: 4 },
    fan: { x: 88, y: -38 },
    order: 3,
  },
  {
    key: 'telegram',
    label: 'تلغرام',
    background: '#229ED9',
    svgPath:
      'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
    mini: { bottom: '8px', right: '18px', zIndex: 3 },
    fan: { x: 98, y: 8 },
    order: 4,
  },
]

// --- Component -------------------------------------------------------------

export default function SocialHub({ urls }: { urls: SocialUrls }) {
  const [open, setOpen] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const fabRef = useRef<HTMLButtonElement | null>(null)
  const fabId = useId()

  // Filter to platforms with a non-empty URL. Order is preserved from
  // the PLATFORMS array (which already reflects the spec's stagger order
  // via `order`), so we can iterate the result directly for both the
  // pentagon cluster and the fan.
  const active = PLATFORMS.filter((p) => {
    const url = urls[p.key]
    return typeof url === 'string' && url.trim().length > 0
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Outside-click + Escape close. Same rAF-defer pattern as the camel
  // greeting bubble — without it, the very click that opens the hub
  // bubbles up to document and immediately fires the close handler.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (rootRef.current && rootRef.current.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        fabRef.current?.focus()
      }
    }
    const id = window.requestAnimationFrame(() => {
      document.addEventListener('mousedown', onPointerDown)
    })
    document.addEventListener('keydown', onKey)
    return () => {
      window.cancelAnimationFrame(id)
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (active.length === 0) return null

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label="مركز التواصل الاجتماعي"
      // start-5 in dir="rtl" resolves to right: 1.25rem — Chatbot uses
      // that for its bottom-right placement. We want the visual LEFT,
      // which is `end-5` in RTL (= left: 1.25rem). z-50 is below the
      // cursor letter trail (z-[2147483647]) and the search overlay,
      // but above article content.
      className="fixed bottom-5 end-5 z-50"
      style={{ width: `${FAB_SIZE_PX}px`, height: `${FAB_SIZE_PX}px` }}
    >
      {/* Fan icons. Always mounted (scale-0 + opacity-0 when closed) so
          the browser can pre-prepare layers and the open transition
          stays smooth — conditional render would re-create DOM on every
          toggle and produce a jank flash. */}
      {active.map((p) => {
        const url = urls[p.key]
        if (!url) return null
        const stagger = open ? `${p.order * STAGGER_MS}ms` : '0ms'
        return (
          <a
            key={p.key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={p.label}
            tabIndex={open ? 0 : -1}
            className="absolute flex items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a2a2f]"
            style={{
              width: `${ICON_SIZE_PX}px`,
              height: `${ICON_SIZE_PX}px`,
              // Anchor at the FAB center, then translate out along the
              // hand-tuned fan path on open. `right` + `bottom` give us
              // physical anchoring regardless of RTL/LTR — start-/end-
              // would confuse the math when the FAB itself is RTL-flipped.
              right: `${(FAB_SIZE_PX - ICON_SIZE_PX) / 2}px`,
              bottom: `${(FAB_SIZE_PX - ICON_SIZE_PX) / 2}px`,
              background: p.background,
              transform: open
                ? `translate(${p.fan.x}px, ${p.fan.y}px) scale(1)`
                : 'translate(0, 0) scale(0)',
              opacity: open ? 1 : 0,
              transition: reducedMotion
                ? 'none'
                : `transform ${FAN_TRANSFORM_MS}ms ${ENTER_EASING} ${stagger}, opacity ${FAN_OPACITY_MS}ms ease-out ${stagger}`,
              zIndex: open ? 2 : 0,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width={ICON_SIZE_PX * 0.5}
              height={ICON_SIZE_PX * 0.5}
              fill="currentColor"
              aria-hidden="true"
            >
              <path d={p.svgPath} />
            </svg>
          </a>
        )
      })}

      {/* The FAB itself. Rotates 45° on open; the inner pentagon cluster
          fades to 35 % so the FAB visually reads as an "X" close
          affordance. Sits on z-index 1 so the fan icons (z-2 when open)
          fly out from "behind" it. */}
      <button
        ref={fabRef}
        id={fabId}
        type="button"
        aria-label={open ? 'إغلاق روابط التواصل الاجتماعي' : 'فتح روابط التواصل الاجتماعي'}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="absolute inset-0 flex items-center justify-center rounded-full transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c8964a] focus-visible:ring-offset-2"
        style={{
          background: '#0a2a2f',
          border: '1.5px solid #c8964a',
          boxShadow: '0 4px 12px rgba(10, 42, 47, 0.25)',
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
          transition: reducedMotion ? 'none' : `transform ${FAB_ROTATE_MS}ms ${ENTER_EASING}`,
          zIndex: 1,
        }}
      >
        {/* Pentagon cluster — five mini icons, same brand colors and
            glyphs as the open-fan, in the spec's spatial arrangement.
            Each mini circle is 20 px with a 1.5 px navy border so it
            reads as separate from the FAB background. The cluster
            scales/positions inside the FAB's coordinate space via
            absolute placement. */}
        <span
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            opacity: open ? 0.35 : 1,
            transition: reducedMotion ? 'none' : `opacity ${FAB_ROTATE_MS}ms ease`,
          }}
        >
          {PLATFORMS.map((p) => (
            <MiniIcon key={p.key} background={p.background} svgPath={p.svgPath} mini={p.mini} />
          ))}
        </span>
      </button>
    </div>
  )
}

// One mini icon in the pentagon cluster. Position comes from the
// platform def. `transform: translateX(-50%)` only applies when `left`
// is the percent value "50%" — kept as a one-line conditional so the
// other four corners use raw absolute positioning.
function MiniIcon({
  background,
  svgPath,
  mini,
}: {
  background: string
  svgPath: string
  mini: PlatformDef['mini']
}) {
  const needsCenterShift = mini.left === '50%'
  return (
    <span
      className="absolute flex items-center justify-center rounded-full text-white"
      style={{
        width: `${MINI_SIZE_PX}px`,
        height: `${MINI_SIZE_PX}px`,
        background,
        border: '1.5px solid #0a2a2f',
        top: mini.top,
        left: mini.left,
        right: mini.right,
        bottom: mini.bottom,
        zIndex: mini.zIndex,
        transform: needsCenterShift ? 'translateX(-50%)' : undefined,
      }}
    >
      <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true">
        <path d={svgPath} />
      </svg>
    </span>
  )
}
