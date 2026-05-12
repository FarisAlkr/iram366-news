'use client'

/**
 * Arabic-calligraphy ink trail that follows the cursor.
 *
 * Design choices that aren't obvious from the code:
 *
 *  - **Canvas over SVG.** SVG would need per-frame path attribute updates and
 *    a long `points` string; canvas with per-segment stroke calls is the
 *    cheapest way to get variable line width with subpixel rendering on retina.
 *  - **Speed-inverse width.** Fast motion → thin (laser-pen feel) is wrong for
 *    ink. Slow motion → thick is what a wet nib actually does. Exponential
 *    smoothing on the speed prevents pixel-width jitter.
 *  - **Two-pass stroke.** A 30% bleed pass 1px wider in #d4a574, then the
 *    primary pass in #c8964a, simulates ink absorbing into paper.
 *  - **Text-aware fade.** Reading is the primary use of this site. We poll
 *    `elementFromPoint` only every 80ms (not per frame — that call forces a
 *    layout flush) and exponentially interpolate the alpha so the trail
 *    quietly dims to ~20% over body text.
 *  - **gsap.ticker, not rAF.** GSAP's ticker is throttled with tab visibility
 *    and synced to the same heartbeat as the camel timeline; running both off
 *    the same ticker avoids two competing animation loops.
 *
 * Mounted from `(frontend)/layout.tsx` behind both an env-var kill switch
 * (`NEXT_PUBLIC_FEATURE_CURSOR_INK`) and a runtime admin toggle
 * (`siteSettings.enableCursorInk`). The component itself additionally
 * no-ops on touch pointers and on `prefers-reduced-motion: reduce`.
 */

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

// --- Tunables ---------------------------------------------------------------

const MAX_SAMPLES = 40
const WIDTH_FAST = 1.5
const WIDTH_SLOW = 5
const SPEED_FOR_THIN = 2.5 // px per ms; >= this collapses to WIDTH_FAST
const SPEED_SMOOTHING = 0.2 // exp-smoothing alpha on per-sample speed
const TIP_ALPHA = 0.85
const COLOR_PRIMARY = '#c8964a'
const COLOR_BLEED = '#d4a574'
const BLEED_ALPHA = 0.3
const TEXT_HIT_INTERVAL_MS = 80
const TEXT_ALPHA_DAMPEN = 0.2
const TEXT_ALPHA_SMOOTHING = 0.15
const IDLE_MS = 200
const IDLE_FADE_PER_SECOND = 0.95 // 95% fade per second once idle
const TEXT_SELECTORS = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,[data-richtext],.prose,.prose *'

interface Sample {
  x: number
  y: number
  t: number // timestamp ms
  width: number // computed at sample time
}

export default function CursorInk() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    // Hard opt-outs. Any of these → render nothing.
    if (typeof window === 'undefined') return
    if (window.matchMedia('(pointer: coarse)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // /admin is Payload's UI; its own cursor + interactions shouldn't be
    // overridden by the calligraphy pen. Belt-and-braces — the
    // (frontend)/layout.tsx route group already excludes /admin, but
    // this defends against a future reshuffle of layouts.
    if (window.location.pathname.startsWith('/admin')) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    // Swap the default arrow for the pen-shaped cursor while the
    // calligraphy trail is active. globals.css owns the cursor URL and
    // the interactive-element overrides; this component just toggles the
    // class on <body> in lockstep with the trail's lifetime.
    document.body.classList.add('has-pen-cursor')

    // --- Sizing with devicePixelRatio --------------------------------------

    let dpr = window.devicePixelRatio || 1
    const resize = () => {
      dpr = window.devicePixelRatio || 1
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }
    resize()
    window.addEventListener('resize', resize, { passive: true })

    // --- Cursor sampling ---------------------------------------------------

    const samples: Sample[] = []
    let lastMoveTime = performance.now()
    let lastSpeed = 0 // smoothed
    let lastTextHitCheck = 0
    let textHitMultiplier = 1 // 1 = clear text, TEXT_ALPHA_DAMPEN = over text
    let textHitSmoothed = 1
    let idleFadeMultiplier = 1

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now()
      const last = samples[samples.length - 1]
      let speed = 0
      if (last) {
        const dt = Math.max(1, now - last.t)
        const dx = e.clientX - last.x
        const dy = e.clientY - last.y
        const instSpeed = Math.hypot(dx, dy) / dt
        speed = lastSpeed * (1 - SPEED_SMOOTHING) + instSpeed * SPEED_SMOOTHING
      }
      lastSpeed = speed

      // Map speed → width inversely. Clamp speed to [0, SPEED_FOR_THIN].
      const speedClamped = Math.min(speed, SPEED_FOR_THIN)
      const t = speedClamped / SPEED_FOR_THIN
      const width = WIDTH_SLOW + (WIDTH_FAST - WIDTH_SLOW) * t

      samples.push({ x: e.clientX, y: e.clientY, t: now, width })
      if (samples.length > MAX_SAMPLES) samples.shift()

      lastMoveTime = now
      idleFadeMultiplier = 1 // any movement resets idle fade
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })

    // Full buffer clear when the cursor leaves the document or the window
    // loses focus. Without this, switching tabs / alt-tabbing / hovering
    // off-page would leave a stale trail snapshot, and the next mouse re-
    // entry would draw a ghost line from the last on-page position to the
    // re-entry point.
    const clearBuffer = () => {
      samples.length = 0
      lastSpeed = 0
      idleFadeMultiplier = 1
    }
    document.addEventListener('mouseleave', clearBuffer)
    window.addEventListener('blur', clearBuffer)

    // --- Text-aware alpha (throttled) --------------------------------------
    // elementFromPoint is layout-flushing — keep it off the per-frame path.

    const checkTextHit = (now: number) => {
      if (now - lastTextHitCheck < TEXT_HIT_INTERVAL_MS) return
      lastTextHitCheck = now
      const tip = samples[samples.length - 1]
      if (!tip) {
        textHitMultiplier = 1
        return
      }
      const el = document.elementFromPoint(tip.x, tip.y)
      if (el && el.closest && el.closest(TEXT_SELECTORS)) {
        textHitMultiplier = TEXT_ALPHA_DAMPEN
      } else {
        textHitMultiplier = 1
      }
    }

    // --- Render ------------------------------------------------------------

    let lastFrameTime = performance.now()

    const render = () => {
      const now = performance.now()
      const dt = Math.max(0, (now - lastFrameTime) / 1000) // seconds
      lastFrameTime = now

      checkTextHit(now)

      // Exponential interpolation toward the target text-hit multiplier so
      // entering / leaving body text doesn't snap visually.
      textHitSmoothed += (textHitMultiplier - textHitSmoothed) * TEXT_ALPHA_SMOOTHING

      // Idle fade: once no movement for IDLE_MS, decay multiplier toward 0
      // *and* actively shrink the sample buffer. The alpha fade alone wasn't
      // enough: after a long idle, the next pointermove instantly reset
      // idleFadeMultiplier to 1, but the old samples were still in the
      // buffer — so a "ghost stroke" connected the user's old position to
      // their new one in a single frame.
      //
      // Shrinking the buffer in lockstep with the fade ensures that by the
      // time the trail is visually gone, the samples that drew it are gone
      // too. 40-sample buffer with 1 drop per ~16ms frame → cleared in
      // ~640ms, comfortably inside the 500–800ms target.
      if (now - lastMoveTime > IDLE_MS) {
        idleFadeMultiplier *= Math.pow(1 - IDLE_FADE_PER_SECOND, dt)
        if (samples.length > 0) samples.shift()
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (samples.length < 2) return
      const globalAlpha = textHitSmoothed * idleFadeMultiplier
      if (globalAlpha < 0.01) return

      // Two passes per segment: bleed (wider, fainter), then primary on top.
      // Segments are ordered tail→tip; alpha ramps tail (0) → tip (TIP_ALPHA).
      const n = samples.length

      ctx.strokeStyle = COLOR_BLEED
      for (let i = 0; i < n - 1; i++) {
        const a = samples[i]
        const b = samples[i + 1]
        if (!a || !b) continue
        const segAlpha = (i / (n - 1)) * TIP_ALPHA * BLEED_ALPHA * globalAlpha
        if (segAlpha <= 0) continue
        ctx.globalAlpha = segAlpha
        ctx.lineWidth = (a.width + b.width) / 2 + 1
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }

      ctx.strokeStyle = COLOR_PRIMARY
      for (let i = 0; i < n - 1; i++) {
        const a = samples[i]
        const b = samples[i + 1]
        if (!a || !b) continue
        const segAlpha = (i / (n - 1)) * TIP_ALPHA * globalAlpha
        if (segAlpha <= 0) continue
        ctx.globalAlpha = segAlpha
        ctx.lineWidth = (a.width + b.width) / 2
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }

      ctx.globalAlpha = 1
    }

    gsap.ticker.add(render)

    return () => {
      gsap.ticker.remove(render)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('mouseleave', clearBuffer)
      window.removeEventListener('blur', clearBuffer)
      document.body.classList.remove('has-pen-cursor')
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        mixBlendMode: 'multiply',
        // Max safe z-index. `mix-blend-mode: multiply` + `position: fixed`
        // promotes this canvas to its own compositor layer; in some browsers
        // that layer doesn't repaint cleanly over regions with their own
        // stacking contexts (sticky headers, mixed-blend descendants,
        // contained components) — so previously-drawn strokes appeared to
        // "stick" in the sidebar / footer instead of clearing each frame.
        // pointer-events: none means an arbitrarily large z-index can't
        // hijack any user interaction; the only cost is making sure no
        // future overlay ever needs to render above the ink.
        zIndex: 2147483647,
      }}
    />
  )
}
