'use client'

/**
 * Seasonal Eid al-Adha falling-sheep overlay.
 *
 * Pure CSS animation — no JS animation loop. Each sheep is an absolutely
 * positioned <span> that translates from above the viewport to below it on
 * a keyframe (`iram-sheep-fall`) with a randomized left column, delay,
 * duration, size, and sway phase. Once the keyframe loops, the sheep starts
 * the same trajectory again — so the layer stays populated without any
 * setInterval / requestAnimationFrame supervision from this component.
 *
 * Why a client component:
 *   - We pick the sheep count off `window.innerWidth` (fewer on mobile so
 *     the effect doesn't dominate small screens) and randomize per-sheep
 *     props on mount. Both need the browser.
 *   - prefers-reduced-motion check happens via matchMedia; under reduced
 *     motion the component renders nothing at all.
 *
 * Accessibility / interaction:
 *   - The whole layer is aria-hidden and pointer-events: none, so it
 *     doesn't interfere with screen readers or block clicks on real UI.
 *   - z-index sits above page content but below modals/chatbot/social hub.
 *
 * The asset is an inline SVG sheep (white body, tan head, four legs).
 * Inline keeps it license-clean and avoids a network round-trip for an
 * image that's repeated ~20× on the page.
 */

import { useEffect, useState } from 'react'

type Sheep = {
  id: number
  leftPct: number
  delaySec: number
  durationSec: number
  swayDurationSec: number
  sizePx: number
  swayPx: number
}

function buildSheep(count: number): Sheep[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    leftPct: Math.random() * 100,
    // Negative delays so sheep are already mid-fall on first paint instead
    // of all queueing up at the top of the viewport for the first cycle.
    delaySec: -Math.random() * 12,
    durationSec: 9 + Math.random() * 8, // 9–17s
    swayDurationSec: 3 + Math.random() * 3, // 3–6s
    sizePx: 28 + Math.floor(Math.random() * 18), // 28–46px
    swayPx: 10 + Math.floor(Math.random() * 22), // 10–32px lateral travel
  }))
}

export default function FallingSheep() {
  const [sheep, setSheep] = useState<Sheep[] | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Tablet/desktop get the full flock; phones get a calmer ~10 to keep
    // the small viewport from feeling busy.
    const count = window.innerWidth < 640 ? 10 : 22
    setSheep(buildSheep(count))
  }, [])

  if (!sheep) return null

  return (
    <div className="iram-eid-sheep-layer" aria-hidden="true">
      {sheep.map((s) => (
        <span
          key={s.id}
          className="iram-eid-sheep"
          style={{
            left: `${s.leftPct}%`,
            width: `${s.sizePx}px`,
            height: `${s.sizePx}px`,
            animationDelay: `${s.delaySec}s, ${s.delaySec}s`,
            animationDuration: `${s.durationSec}s, ${s.swayDurationSec}s`,
            // Custom property consumed by the sway keyframe so each sheep
            // drifts a different amount left-to-right.
            ['--iram-sway' as string]: `${s.swayPx}px`,
          }}
        >
          <SheepGlyph />
        </span>
      ))}
    </div>
  )
}

function SheepGlyph() {
  return (
    <svg
      viewBox="0 0 60 50"
      width="100%"
      height="100%"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {/* Legs (drawn first so the body covers their tops) */}
      <rect x="18" y="32" width="3" height="9" rx="1" fill="#2a1a08" />
      <rect x="25" y="34" width="3" height="9" rx="1" fill="#2a1a08" />
      <rect x="33" y="34" width="3" height="9" rx="1" fill="#2a1a08" />
      <rect x="40" y="32" width="3" height="9" rx="1" fill="#2a1a08" />

      {/* Fluffy white body — three overlapping circles for a cloud-like
          silhouette, with a fourth lower-center circle hiding the seams. */}
      <circle cx="20" cy="26" r="9" fill="#fafafa" />
      <circle cx="30" cy="22" r="10" fill="#fafafa" />
      <circle cx="40" cy="26" r="9" fill="#fafafa" />
      <circle cx="30" cy="30" r="9" fill="#fafafa" />

      {/* Tail tuft at the back */}
      <circle cx="13" cy="24" r="3" fill="#fafafa" />

      {/* Head — tan oval forward of the body */}
      <ellipse cx="48" cy="24" rx="6" ry="5.5" fill="#c8964a" />
      {/* Snout highlight */}
      <ellipse cx="51" cy="26" rx="2.4" ry="1.8" fill="#e2c08c" />
      {/* Eye */}
      <circle cx="49" cy="22" r="0.9" fill="#2a1a08" />
      {/* Ears */}
      <ellipse cx="45" cy="19" rx="1.6" ry="2.6" fill="#a37633" transform="rotate(-20 45 19)" />
      <ellipse cx="50" cy="18" rx="1.4" ry="2.4" fill="#a37633" transform="rotate(15 50 18)" />
    </svg>
  )
}
