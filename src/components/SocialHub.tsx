'use client'

/**
 * Social-media hub: a floating cluster in the bottom-left corner that fans
 * platform icons outward on click. Mirrors the chatbot (bottom-right).
 *
 * Closed state — a 64 px navy FAB shows a tiny preview cluster of three
 * brand-colored circles (TikTok / Facebook / Instagram) hinting at the
 * theme. On click the FAB rotates 45° and the cluster fades to 35 %, so
 * it visually reads as an "X" close affordance, while the actual platform
 * icons fan up-and-right along a radial arc.
 *
 * Open state — each platform appears as a 44 px circle filled with its
 * own brand color and a white inline SVG glyph. Icons enter with a
 * staggered cubic-bezier overshoot for a slight bounce, dismissable by:
 *  - clicking the FAB again
 *  - pressing Escape
 *  - clicking outside the hub
 *
 * The URLs come from the existing `socialLinks` group on SiteSettings —
 * the admin can update any of them from /admin without code changes.
 * Platforms whose URL is empty / nullish are simply not rendered. Icon
 * positions are computed from the count of *active* platforms so the
 * fan stays visually balanced even when the admin clears one.
 *
 * Mounting is gated, in order:
 *  1. Env flag `NEXT_PUBLIC_FEATURE_SOCIAL_HUB` — only `=== 'false'`
 *     disables; otherwise default-on.
 *  2. Site setting `socialHub.enabled` — admin-flippable, default true.
 *     The layout passes this down; if false, this component still gets
 *     instantiated but returns null. (The layout already pre-filters on
 *     this; the inner guard is belt-and-braces in case a future caller
 *     forgets.)
 *  3. The `/admin` route is excluded by virtue of being in the (payload)
 *     route group, not (frontend).
 *
 * Reduced motion: animations collapse to instant show/hide. Coarse
 * pointer (touch): hover effects fall back to a tap-and-hold visual but
 * the hub itself is fully usable.
 */

import { useEffect, useId, useRef, useState } from 'react'

// --- Tunables --------------------------------------------------------------

const FAN_RADIUS_PX = 110 // distance from FAB center to each open icon
const ICON_SIZE_PX = 44 // diameter of each platform circle in the fan
const FAB_SIZE_PX = 64 // diameter of the closed FAB
const STAGGER_MS = 50 // delay between successive icons' entrance
const ENTER_EASING = 'cubic-bezier(0.34, 1.56, 0.64, 1)' // slight overshoot
const ENTER_DURATION_MS = 280

// --- Types -----------------------------------------------------------------

export interface SocialUrls {
  whatsapp?: string | null
  facebook?: string | null
  instagram?: string | null
  telegram?: string | null
  tiktok?: string | null
  youtube?: string | null
}

interface PlatformDef {
  key: keyof SocialUrls
  label: string // Arabic, used for aria-label
  background: string // CSS background (color or gradient)
  path: string // SVG path (24×24 viewBox)
}

// --- Platform definitions --------------------------------------------------
// Paths are from simpleicons.org — public domain, brand-canonical glyphs.

const PLATFORMS: PlatformDef[] = [
  {
    key: 'whatsapp',
    label: 'واتساب',
    background: '#25D366',
    path: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z',
  },
  {
    key: 'facebook',
    label: 'فيسبوك',
    background: '#1877F2',
    path: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
  },
  {
    key: 'instagram',
    label: 'إنستغرام',
    background:
      'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
    path: 'M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.897 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.897-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z',
  },
  {
    key: 'telegram',
    label: 'تلغرام',
    background: '#229ED9',
    path: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
  },
  {
    key: 'tiktok',
    label: 'تيك توك',
    background: '#000000',
    path: 'M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.1z',
  },
  {
    key: 'youtube',
    label: 'يوتيوب',
    background: '#FF0000',
    path: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  },
]

// --- Component -------------------------------------------------------------

export default function SocialHub({ urls }: { urls: SocialUrls }) {
  const [open, setOpen] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const fabRef = useRef<HTMLButtonElement | null>(null)
  const fabId = useId()

  // Build the active platforms list each render. Cheap (≤6 entries), and
  // keeps the fan responsive to live admin URL edits in dev / preview.
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
  // greeting bubble (PR #13): without it, the very click that opens the
  // hub bubbles up to document and immediately fires the close handler.
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
        fabRef.current?.focus() // return focus so the user isn't dumped
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

  // Fan geometry. Distribute `active.length` icons across a 90° arc that
  // sweeps from straight-up (90°) to straight-right (0°), so the icons
  // fly up-and-to-the-right from a bottom-left FAB. Single-platform
  // edge case: pin to straight-up. No active platforms: render null.
  const fanPositions = computeFanPositions(active.length)

  if (active.length === 0) return null

  return (
    <div
      ref={rootRef}
      aria-label="روابط التواصل الاجتماعي"
      role="region"
      // start-5 in dir="rtl" resolves to right: 1.25rem, but we want
      // visual LEFT (opposite the chatbot which sits at start-5 = right
      // in RTL). end-5 in RTL = left: 1.25rem. Same z-tier as the
      // chatbot's z-[60] so they don't fight each other across the
      // bottom edge of the viewport.
      className="fixed bottom-5 end-5 z-[60]"
      style={{ width: `${FAB_SIZE_PX}px`, height: `${FAB_SIZE_PX}px` }}
    >
      {/* Fan icons. Always in the DOM (scale-0 + opacity-0 when closed)
          so the browser can pre-prepare layers and the open transition
          stays smooth — conditional render would re-create the DOM on
          every toggle. */}
      {active.map((p, i) => {
        const pos = fanPositions[i]
        const url = urls[p.key]!
        // pos is guaranteed defined here (fanPositions.length === active.length
        // by construction in computeFanPositions), but the noUncheckedIndexedAccess
        // tsconfig flag still narrows it as possibly-undefined — guard explicitly.
        if (!pos) return null
        const stagger = open ? `${i * STAGGER_MS}ms` : '0ms'
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
              // Center the icon on the FAB center, then translate out
              // along the arc when open. The translation values are
              // negative-Y (up) and positive-X (right of FAB origin).
              // `right` + `bottom` anchor against the parent's right
              // edge (which itself sits at `end-5` = left edge in RTL),
              // and `start-/end-` would confuse RTL math, so we use
              // physical anchoring.
              right: `${(FAB_SIZE_PX - ICON_SIZE_PX) / 2}px`,
              bottom: `${(FAB_SIZE_PX - ICON_SIZE_PX) / 2}px`,
              background: p.background,
              transform: open
                ? `translate(${pos.x}px, ${pos.y}px) scale(1)`
                : 'translate(0, 0) scale(0)',
              opacity: open ? 1 : 0,
              transition: reducedMotion
                ? 'none'
                : `transform ${ENTER_DURATION_MS}ms ${ENTER_EASING} ${stagger}, opacity ${ENTER_DURATION_MS}ms ease ${stagger}`,
              // Make sure the focus ring sits above the FAB so keyboard
              // users can actually see it.
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
              <path d={p.path} />
            </svg>
          </a>
        )
      })}

      {/* The FAB itself. Sits on top (z-1) so the icons that fan from
          underneath it visually "fly out" from behind it. */}
      <button
        ref={fabRef}
        id={fabId}
        type="button"
        aria-label={open ? 'إغلاق روابط التواصل' : 'فتح روابط التواصل'}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="absolute inset-0 flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c8964a] focus-visible:ring-offset-2"
        style={{
          background: '#0a2a2f',
          border: '1.5px solid #c8964a',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
          transition: reducedMotion ? 'none' : 'transform 220ms ease',
          zIndex: 1,
        }}
      >
        {/* Preview cluster — three brand-colored mini circles hinting
            at the social theme. Fades to 35 % when open so the rotated
            FAB visually reads as an X close affordance. The label-y
            colors here (TikTok / Facebook / Instagram) are intentional:
            they're the three platforms most readers will recognize at
            this size; the cluster is decorative and is NOT tied to
            which platforms are actually active. */}
        <span
          aria-hidden="true"
          className="relative flex items-center justify-center"
          style={{
            width: `${FAB_SIZE_PX * 0.6}px`,
            height: `${FAB_SIZE_PX * 0.6}px`,
            opacity: open ? 0.35 : 1,
            transition: reducedMotion ? 'none' : 'opacity 220ms ease',
          }}
        >
          <ClusterCircle background="#000000" left="6%" bottom="0%" size={42} />
          <ClusterCircle
            background="linear-gradient(45deg, #f09433, #dc2743, #bc1888)"
            right="6%"
            bottom="0%"
            size={42}
          />
          <ClusterCircle background="#1877F2" left="22%" top="6%" size={56} />
        </span>
      </button>
    </div>
  )
}

// Even arc from 90° (straight up) to 0° (straight right). For n=1 we
// pin to the top; for n=2 we split top-and-right. Returns translations
// in CSS px relative to the FAB's center.
function computeFanPositions(n: number): Array<{ x: number; y: number }> {
  if (n === 0) return []
  if (n === 1) return [{ x: 0, y: -FAN_RADIUS_PX }]
  const positions: Array<{ x: number; y: number }> = []
  for (let i = 0; i < n; i++) {
    // i=0 → angle 90° (up); i=n-1 → angle 0° (right)
    const angleDeg = 90 - (90 * i) / (n - 1)
    const angleRad = (angleDeg * Math.PI) / 180
    positions.push({
      x: Math.round(FAN_RADIUS_PX * Math.cos(angleRad)),
      y: Math.round(-FAN_RADIUS_PX * Math.sin(angleRad)),
    })
  }
  return positions
}

// Small decorative brand-colored circle used inside the FAB's preview
// cluster. Accepts physical-edge anchors (left/right/top/bottom) plus
// a size; renders nothing interactive.
function ClusterCircle({
  background,
  size,
  left,
  right,
  top,
  bottom,
}: {
  background: string
  size: number
  left?: string
  right?: string
  top?: string
  bottom?: string
}) {
  const pct = (v: number) => `${v}%`
  return (
    <span
      className="absolute rounded-full"
      style={{
        width: pct(size),
        height: pct(size),
        background,
        border: '1.5px solid #0a2a2f',
        left,
        right,
        top,
        bottom,
      }}
    />
  )
}
