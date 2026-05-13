'use client'

/**
 * Arabic-calligraphy letter trail that follows the cursor.
 *
 * Historical note on the filename / component name: this component was
 * originally an Arabic-ink stroke trail. The mechanic was rewritten to
 * stamp out the letters of "إرم 366 الإخبارية" one at a time at the
 * cursor position. The file & default export keep their original
 * `CursorInk` name because the admin toggle (`siteSettings.signatureUi
 * .enableCursorInk`) and the build-time env flag
 * (`NEXT_PUBLIC_FEATURE_CURSOR_INK`) both reference the old name —
 * renaming would require a Payload schema migration just to relabel a
 * boolean, which isn't worth it.
 *
 * Design choices that aren't obvious from the code:
 *
 *  - **Per-distance stamping, not per-frame.** Letters are placed every
 *    ~60 px of accumulated cursor travel, not once per animation frame.
 *    Per-frame placement would dump a dense cluster of letters whenever
 *    the cursor stopped, and would space letters arbitrarily based on
 *    cursor speed. Distance-based stamping gives a steady visual
 *    rhythm regardless of how fast the user moves.
 *  - **Ring buffer of stamps.** Bounded at MAX_STAMPS so the render
 *    cost stays predictable even on a long, fast cursor swipe.
 *  - **Age-based fade.** Each stamp carries its own age counter that
 *    increments per frame. Opacity = 1 - age/MAX_AGE. When a stamp's
 *    age exceeds MAX_AGE it's removed from the buffer. This is cheap
 *    and avoids any timeline / GSAP overhead.
 *  - **Stop stamping when idle.** After 500 ms without movement we
 *    stop adding new stamps. Existing stamps continue to fade out
 *    naturally; once the buffer is empty the render loop short-circuits.
 *  - **Early-exit when buffer is empty.** Letter rendering with
 *    `fillText` is more expensive than the old per-segment stroke
 *    passes — without an early exit on an empty buffer we'd burn CPU
 *    drawing transparent canvases forever on any idle page.
 *  - **Resolved font family read from the canvas.** Canvas `ctx.font`
 *    is a plain string and cannot resolve CSS variables, so the canvas
 *    element wears the `.iram-cursor-letter-trail` class (which sets
 *    `font-family: var(--font-cursor-arabic), serif`) and we read the
 *    resolved family back via `getComputedStyle` to build the font shorthand.
 *  - **gsap.ticker, not rAF.** Same as before: GSAP's ticker is throttled
 *    with tab visibility and synced to the camel timeline.
 *
 * Mounted from `(frontend)/layout.tsx` behind both an env-var kill switch
 * (`NEXT_PUBLIC_FEATURE_CURSOR_INK`) and a runtime admin toggle
 * (`siteSettings.enableCursorInk`). The component itself additionally
 * no-ops on touch pointers, on `prefers-reduced-motion: reduce`, and
 * on the `/admin` route.
 */

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

// --- Tunables ---------------------------------------------------------------

// The phrase, broken into individual rendering units. Arabic ligatures
// are handled by the font (Amiri shapes letters contextually), so we
// can iterate by Unicode code points. Three hyphens between each word
// act as visual word-separators in the trail — without them the
// glyphs of "إرم", "366" and "الإخبارية" run together in the user's
// eye as one long string of letters. The hyphens are stamped like any
// other character (no whitespace skip in the loop).
const PHRASE = 'إرم---366---الإخبارية'
const LETTERS = Array.from(PHRASE) // safe code-point iteration

const STAMP_DISTANCE_PX = 60 // distance the cursor travels between letter stamps
const MAX_STAMPS = 20 // ring-buffer cap
const MAX_AGE = 60 // frames a stamp lives (≈ 1 s at 60 fps)
const IDLE_MS_TO_STOP_STAMPING = 500 // after this long without movement, stop adding stamps
const PHRASE_PAUSE_MS = 1000 // pause between full iterations of the phrase
const FONT_SIZE_PX = 28
const FONT_WEIGHT = 700
const COLOR = '#c8964a'
const SHADOW_COLOR = 'rgba(0, 0, 0, 0.15)'
const SHADOW_BLUR = 4

interface Stamp {
  char: string
  x: number
  y: number
  age: number // increments per frame; opacity = 1 - age/MAX_AGE
}

export default function CursorInk() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    // Hard opt-outs. Any of these → render nothing.
    if (typeof window === 'undefined') return
    if (window.matchMedia('(pointer: coarse)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // /admin is Payload's UI; its own cursor + interactions shouldn't be
    // overridden by the calligraphy effect. Belt-and-braces — the
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

    // --- Resolve the font family --------------------------------------------
    // next/font generates a hashed family name behind a CSS variable
    // (`--font-cursor-arabic`). Canvas `ctx.font` won't resolve CSS
    // variables, so we read the computed font-family off the canvas
    // (which wears the `.iram-cursor-letter-trail` class declaring the
    // variable) and assemble the font shorthand from it. If the font
    // hasn't loaded yet, the computed family falls back to `serif`
    // (the second token in the CSS stack) and the trail will swap to
    // Amiri seamlessly once it arrives.
    const computedFamily = window.getComputedStyle(canvas).fontFamily || 'serif'
    const fontShorthand = `${FONT_WEIGHT} ${FONT_SIZE_PX}px ${computedFamily}`

    // --- State buffers (declared before resize so it can clear them) -------

    const stamps: Stamp[] = []
    // Walking index into the LETTERS array — never resets, so the
    // sequence resumes from where it left off if the user idles and
    // then moves again. Modulo'd into LETTERS.length at read time.
    let letterIndex = 0
    let lastSampleX = 0
    let lastSampleY = 0
    let haveLastSample = false
    let accumulatedDistance = 0
    let lastMoveTime = performance.now()
    // Timestamp (performance.now) until which new letter stamps are
    // suppressed. Set after each full iteration of the phrase so the
    // sequence pauses for PHRASE_PAUSE_MS before starting the next
    // cycle from index 0. During the pause we still *drain* the
    // accumulated travel distance — otherwise resuming would dump a
    // backlog of stamps at once.
    let pauseUntil = 0

    // --- Sizing with devicePixelRatio + visual viewport --------------------
    // Same zoom/viewport handling as the previous ink-stroke
    // implementation: `window.innerWidth` is the layout viewport which
    // doesn't change on Ctrl-zoom, so we prefer visualViewport when
    // present so the canvas pixel dimensions track what the user
    // actually sees.

    let dpr = window.devicePixelRatio || 1
    const resize = () => {
      dpr = window.devicePixelRatio || 1
      const w = window.visualViewport?.width ?? window.innerWidth
      const h = window.visualViewport?.height ?? window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = fontShorthand
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = SHADOW_COLOR
      ctx.shadowBlur = SHADOW_BLUR
      ctx.fillStyle = COLOR
      // Wipe in-flight stamps — their (x, y) coordinates are in the
      // pre-resize space and would jump after a zoom step. Also reset
      // the sampling state so the next pointermove starts a fresh run.
      stamps.length = 0
      haveLastSample = false
      accumulatedDistance = 0
    }
    resize()
    window.addEventListener('resize', resize, { passive: true })
    window.visualViewport?.addEventListener('resize', resize)
    window.visualViewport?.addEventListener('scroll', resize)

    // --- Cursor sampling ---------------------------------------------------

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now()
      const sinceLastMove = now - lastMoveTime
      lastMoveTime = now

      // After IDLE_MS_TO_STOP_STAMPING of no movement, treat the next
      // pointermove as a fresh start: reset the sample anchor and the
      // accumulator. Without this, a user who left the cursor at 55px
      // of accumulated travel (one short of a stamp) then idled for
      // five minutes and nudged the mouse 10px would see a stamp pop
      // out immediately — instead, idle resets the accumulator so the
      // sequence resumes only after a full STAMP_DISTANCE_PX of fresh
      // motion. (letterIndex is intentionally NOT reset, so the phrase
      // resumes from wherever it left off when the user does start
      // moving again.)
      if (sinceLastMove > IDLE_MS_TO_STOP_STAMPING) {
        haveLastSample = false
        accumulatedDistance = 0
      }

      const x = e.clientX
      const y = e.clientY

      if (!haveLastSample) {
        lastSampleX = x
        lastSampleY = y
        haveLastSample = true
        return
      }

      const dx = x - lastSampleX
      const dy = y - lastSampleY
      accumulatedDistance += Math.hypot(dx, dy)
      lastSampleX = x
      lastSampleY = y

      // Stamp every STAMP_DISTANCE_PX of accumulated travel. We use a
      // `while` rather than an `if` so that very fast cursor jumps still
      // place every letter they swept past — important so the phrase
      // reads in order even when the user flicks the mouse.
      while (accumulatedDistance >= STAMP_DISTANCE_PX) {
        accumulatedDistance -= STAMP_DISTANCE_PX

        // Inter-iteration pause: after the phrase completes, suppress
        // new stamps for PHRASE_PAUSE_MS so the next cycle starts
        // visibly fresh. We still drain accumulatedDistance above so a
        // user moving steadily through the pause doesn't see a burst
        // of stamps the instant the pause ends.
        if (now < pauseUntil) continue

        const ch = LETTERS[letterIndex % LETTERS.length] ?? ''
        letterIndex++
        // Skip whitespace glyphs — stamping a space leaves an awkward
        // visual gap because fillText on " " renders nothing but the
        // sequence still advances. Defensive: PHRASE currently has no
        // whitespace, but this keeps behavior sane if someone edits it.
        if (ch.trim().length === 0) {
          // The check below for "did we just complete a full iteration"
          // still needs to run, hence we don't pre-empt with continue
          // before the modulo check — fall through.
        } else {
          stamps.push({ char: ch, x, y, age: 0 })
          if (stamps.length > MAX_STAMPS) stamps.shift()
        }

        // If letterIndex just hit a multiple of LETTERS.length, we
        // finished a full pass through the phrase — schedule the
        // inter-iteration pause. (letterIndex was just incremented, so
        // value 0 means we haven't placed anything yet, never matches
        // here.)
        if (letterIndex > 0 && letterIndex % LETTERS.length === 0) {
          pauseUntil = now + PHRASE_PAUSE_MS
        }
      }
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })

    // Full buffer clear when the cursor leaves the document or the window
    // loses focus — same rationale as the old implementation: prevents
    // a stale snapshot from reappearing on tab re-entry.
    const clearBuffer = () => {
      stamps.length = 0
      haveLastSample = false
      accumulatedDistance = 0
    }
    document.addEventListener('mouseleave', clearBuffer)
    window.addEventListener('blur', clearBuffer)

    // --- Render ------------------------------------------------------------

    const render = () => {
      // Early-exit on empty buffer. fillText is more expensive than the
      // old per-segment strokes, and the trail spends most of its life
      // empty (idle pages, paused readers) — without this the rAF loop
      // would burn cycles drawing transparent canvases forever.
      // Note: the "stop adding stamps when idle" requirement is satisfied
      // implicitly by pointermove not firing while the cursor is still —
      // accumulatedDistance can't grow without movement, so no new stamps
      // appear. Existing stamps keep aging through the path below until
      // the buffer drains, at which point this early-exit kicks in.
      if (stamps.length === 0) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw first (so a stamp on its very first frame paints at age=0
      // → alpha=1, the visually correct "freshly stamped" state), then
      // age + cull. `fillText` reads the current globalAlpha, fillStyle,
      // font, textAlign, textBaseline, and shadow settings; everything
      // except globalAlpha was locked in by resize() and doesn't change
      // frame-to-frame, so we only twiddle globalAlpha per stamp.
      for (const s of stamps) {
        const alpha = Math.max(0, 1 - s.age / MAX_AGE)
        if (alpha <= 0) continue
        ctx.globalAlpha = alpha
        ctx.fillText(s.char, s.x, s.y)
      }
      ctx.globalAlpha = 1

      // Age each stamp; drop dead ones. Iterate backwards so splice
      // doesn't disturb the indices we still need to visit.
      for (let i = stamps.length - 1; i >= 0; i--) {
        const s = stamps[i]
        if (!s) continue
        s.age += 1
        if (s.age > MAX_AGE) stamps.splice(i, 1)
      }
    }

    gsap.ticker.add(render)

    return () => {
      gsap.ticker.remove(render)
      window.removeEventListener('resize', resize)
      window.visualViewport?.removeEventListener('resize', resize)
      window.visualViewport?.removeEventListener('scroll', resize)
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
      className="iram-cursor-letter-trail"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        // Max safe z-index. `position: fixed` + per-frame paint promotes
        // this canvas to its own compositor layer; in some browsers
        // that layer doesn't repaint cleanly over regions with their own
        // stacking contexts (sticky headers, mixed-blend descendants,
        // contained components) — so previously-drawn letters appeared
        // to "stick" in the sidebar / footer instead of clearing each
        // frame. pointer-events: none means an arbitrarily large
        // z-index can't hijack any user interaction; the only cost is
        // making sure no future overlay ever needs to render above the
        // trail.
        zIndex: 2147483647,
      }}
    />
  )
}
