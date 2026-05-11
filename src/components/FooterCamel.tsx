'use client'

/**
 * A camel that walks back and forth across the footer.
 *
 * Why this is here: it's a signature touch — a small piece of regional
 * character on a publication rooted in the Negev. It mounts inside the
 * footer (not in its own strip) and uses `mix-blend-mode: screen` against
 * the dark navy footer so the existing copy stays readable underneath it.
 *
 * Asset choice: hand-built inline SVG, not Lottie. A Lottie source pre-handoff
 * adds license ambiguity (LottieFiles blocks scripted download, so a JSON
 * checked into the repo can't be cleanly attributed by automation). An SVG
 * keeps the asset auditable, license-clean, and ~2 KB instead of ~30 KB.
 *
 * Animation:
 *   - Walk cycle: GSAP timeline pacing the four legs in a camel "pace" gait
 *     (left-side pair, then right-side pair — not horse-style alternation).
 *     A small body bob is synchronized to footfalls.
 *   - Horizontal motion: a separate timeline tweens the container left↔right
 *     at ~30 px/s with a 2.5 s pause at each edge and a 400 ms turn (scaleX).
 *   - Idle: every 30–90 s the camel pauses and either sniffs (head down) or
 *     ear-flicks. The idle timeline is rebuilt on a setInterval since GSAP
 *     timelines don't natively express "random delay between repeats".
 *   - Hover: pause the walk + play an ear flick. Leave → resume.
 *   - Click: head bow ~10 deg for 400 ms, optional grunt sound (gated on
 *     localStorage opt-in — no UI toggle yet, intentional).
 *   - Cursor tracking: when paused/at-edge, the head rotates ±15 deg toward
 *     the cursor's horizontal position. Disabled while walking — too busy.
 *
 * Accessibility:
 *   - aria-hidden on the visual node; never in tab order.
 *   - prefers-reduced-motion → render a static camel (still hover/click-able).
 *   - coarse pointer → render nothing (no good interaction model on touch).
 */

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

// --- Geometry / tunables ---------------------------------------------------

const SVG_W = 260
const SVG_H = 160
const CAMEL_HEIGHT_PX = 86
const WALK_PX_PER_SEC = 30
const EDGE_PAUSE_SEC = 2.5
const TURN_SEC = 0.4
const LEG_CYCLE_SEC = 1.1 // one full pace step (front-back swap)
const HEAD_TRACK_DURATION = 0.6

// --- Component -------------------------------------------------------------

export default function FooterCamel() {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const camelRef = useRef<HTMLDivElement | null>(null)
  const bodyRef = useRef<SVGGElement | null>(null)
  const headRef = useRef<SVGGElement | null>(null)
  const earRef = useRef<SVGGElement | null>(null)
  const legFLRef = useRef<SVGGElement | null>(null)
  const legFRRef = useRef<SVGGElement | null>(null)
  const legBLRef = useRef<SVGGElement | null>(null)
  const legBRRef = useRef<SVGGElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(pointer: coarse)').matches) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const wrap = wrapRef.current
    const camel = camelRef.current
    const body = bodyRef.current
    const head = headRef.current
    const ear = earRef.current
    const legFL = legFLRef.current
    const legFR = legFRRef.current
    const legBL = legBLRef.current
    const legBR = legBRRef.current
    if (!wrap || !camel || !body || !head || !ear || !legFL || !legFR || !legBL || !legBR) return

    let walkTl: gsap.core.Timeline | null = null
    let legTl: gsap.core.Timeline | null = null
    let idleTimeoutId: number | undefined
    let trackRafId: number | undefined
    let directionFacing: 1 | -1 = 1 // 1 = facing right, -1 = facing left
    let isPaused = false

    const isFacingLeftBecauseRtl = () => {
      // The footer is RTL; we want the camel to start at the visual left
      // and walk to the visual right regardless of writing direction. Visual
      // coordinates are unaffected by `dir`, so we anchor on `left: 0` and
      // the camel just walks across in pixel space.
      return false
    }
    void isFacingLeftBecauseRtl // reserved for future locale-aware tweaks

    // --- Leg cycle (continuous; independent of horizontal motion) ---------

    const buildLegTimeline = () => {
      // Camel pace gait: both legs on the same side move together.
      // Phase 0:    left-side forward,  right-side back
      // Phase 0.5:  left-side back,     right-side forward
      const tl = gsap.timeline({ repeat: -1, paused: reducedMotion })
      tl.to([legFL, legBL], { rotate: 18, duration: LEG_CYCLE_SEC / 2, ease: 'sine.inOut' }, 0)
        .to([legFR, legBR], { rotate: -18, duration: LEG_CYCLE_SEC / 2, ease: 'sine.inOut' }, 0)
        .to(
          [legFL, legBL],
          { rotate: -18, duration: LEG_CYCLE_SEC / 2, ease: 'sine.inOut' },
          LEG_CYCLE_SEC / 2,
        )
        .to(
          [legFR, legBR],
          { rotate: 18, duration: LEG_CYCLE_SEC / 2, ease: 'sine.inOut' },
          LEG_CYCLE_SEC / 2,
        )
        // Body bob — sine wave, twice per cycle (one bob per leg pair).
        .to(body, { y: -2, duration: LEG_CYCLE_SEC / 4, ease: 'sine.inOut' }, 0)
        .to(body, { y: 0, duration: LEG_CYCLE_SEC / 4, ease: 'sine.inOut' }, LEG_CYCLE_SEC / 4)
        .to(body, { y: -2, duration: LEG_CYCLE_SEC / 4, ease: 'sine.inOut' }, LEG_CYCLE_SEC / 2)
        .to(
          body,
          { y: 0, duration: LEG_CYCLE_SEC / 4, ease: 'sine.inOut' },
          (LEG_CYCLE_SEC * 3) / 4,
        )
      return tl
    }

    // --- Horizontal walk + turn at edges ----------------------------------

    const buildWalkTimeline = () => {
      const wrapWidth = wrap.clientWidth
      const camelWidth = camel.offsetWidth
      const travel = Math.max(0, wrapWidth - camelWidth)
      const stepDuration = travel / WALK_PX_PER_SEC

      // Camel pauses at each end, turns, then walks back.
      const tl = gsap.timeline({ repeat: -1, paused: reducedMotion })
      tl.to(camel, { x: travel, duration: stepDuration, ease: 'none' })
        .to({}, { duration: EDGE_PAUSE_SEC }) // dwell
        .call(() => {
          directionFacing = -1
          gsap.to(camel, { scaleX: -1, duration: TURN_SEC, ease: 'power2.inOut' })
        })
        .to({}, { duration: TURN_SEC })
        .to(camel, { x: 0, duration: stepDuration, ease: 'none' })
        .to({}, { duration: EDGE_PAUSE_SEC })
        .call(() => {
          directionFacing = 1
          gsap.to(camel, { scaleX: 1, duration: TURN_SEC, ease: 'power2.inOut' })
        })
        .to({}, { duration: TURN_SEC })
      return tl
    }

    legTl = buildLegTimeline()
    walkTl = buildWalkTimeline()

    // Rebuild walk timeline on container resize so travel distance stays right.
    const ro = new ResizeObserver(() => {
      const progress = walkTl?.progress() ?? 0
      walkTl?.kill()
      walkTl = buildWalkTimeline()
      walkTl.progress(progress)
      if (isPaused || reducedMotion) walkTl.pause()
    })
    ro.observe(wrap)

    // --- Idle behaviors (random sniff / ear flick) ------------------------

    const playSniff = () => {
      if (reducedMotion) return
      gsap
        .timeline()
        .to(head, { rotate: 14, y: 4, duration: 0.5, ease: 'power2.out' })
        .to(head, { rotate: 14, y: 4, duration: 0.6 }) // hold (sniff)
        .to(head, { rotate: 0, y: 0, duration: 0.5, ease: 'power2.inOut' })
    }

    const playEarFlick = () => {
      if (reducedMotion) return
      gsap
        .timeline()
        .to(ear, { rotate: -22, duration: 0.12, ease: 'power2.out' })
        .to(ear, { rotate: 0, duration: 0.18, ease: 'power2.in' })
        .to(ear, { rotate: -14, duration: 0.1, ease: 'power2.out' })
        .to(ear, { rotate: 0, duration: 0.18, ease: 'power2.in' })
    }

    const scheduleIdle = () => {
      const delay = 30_000 + Math.random() * 60_000
      idleTimeoutId = window.setTimeout(() => {
        // Don't fire idle while user is interacting (hover-paused).
        if (!isPaused) {
          if (Math.random() < 0.6) playSniff()
          else playEarFlick()
        }
        scheduleIdle()
      }, delay)
    }
    scheduleIdle()

    // --- Cursor head-tracking (only when paused / at edge) ----------------

    let lastCursorX = 0
    const onMouseMove = (e: MouseEvent) => {
      lastCursorX = e.clientX
    }
    window.addEventListener('mousemove', onMouseMove, { passive: true })

    const tickHeadTrack = () => {
      // Only track when the horizontal timeline is paused (edge or hover).
      // Detect "edge dwell" as: x-tween for `camel` is currently not changing.
      // Simpler proxy: read the timeline's current label segment via paused().
      const walkPaused = walkTl?.paused() || isPaused
      if (walkPaused) {
        const camelRect = camel.getBoundingClientRect()
        const center = camelRect.left + camelRect.width / 2
        const dx = lastCursorX - center
        // Map dx to ±15deg; saturate beyond ~250px.
        const target = Math.max(-15, Math.min(15, (dx / 250) * 15))
        // Note: when scaleX is -1, "rotate" on the head still rotates in
        // visual coordinates because the scale is applied to the wrapper,
        // not the head. Negate to match visual direction.
        const visual = directionFacing === -1 ? -target : target
        gsap.to(head, { rotate: visual, duration: HEAD_TRACK_DURATION, ease: 'power2.out' })
      }
      trackRafId = window.requestAnimationFrame(tickHeadTrack)
    }
    if (!reducedMotion) trackRafId = window.requestAnimationFrame(tickHeadTrack)

    // --- Hover / click ----------------------------------------------------

    const onEnter = () => {
      isPaused = true
      walkTl?.pause()
      legTl?.pause()
      playEarFlick()
    }
    const onLeave = () => {
      isPaused = false
      if (!reducedMotion) {
        walkTl?.resume()
        legTl?.resume()
      }
      gsap.to(head, { rotate: 0, duration: 0.4, ease: 'power2.out' })
    }
    const onClick = () => {
      // Bow head ~10deg, hold 400ms, release. Independent of pause state.
      gsap
        .timeline()
        .to(head, { rotate: 14, duration: 0.18, ease: 'power2.out' })
        .to(head, { rotate: 14, duration: 0.4 })
        .to(head, { rotate: 0, duration: 0.25, ease: 'power2.inOut' })

      if (typeof window !== 'undefined' && localStorage.getItem('iram_sound_enabled') === 'true') {
        // Sound asset is optional — keep silent if it isn't shipped.
        const audio = new Audio('/sounds/camel-grunt.mp3')
        audio.volume = 0.4
        audio.play().catch(() => {
          /* autoplay or missing file — silently ignore */
        })
      }
    }

    camel.addEventListener('pointerenter', onEnter)
    camel.addEventListener('pointerleave', onLeave)
    camel.addEventListener('click', onClick)

    return () => {
      walkTl?.kill()
      legTl?.kill()
      ro.disconnect()
      if (idleTimeoutId !== undefined) window.clearTimeout(idleTimeoutId)
      if (trackRafId !== undefined) window.cancelAnimationFrame(trackRafId)
      window.removeEventListener('mousemove', onMouseMove)
      camel.removeEventListener('pointerenter', onEnter)
      camel.removeEventListener('pointerleave', onLeave)
      camel.removeEventListener('click', onClick)
    }
  }, [])

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        bottom: 0,
        top: 'auto',
        height: `${CAMEL_HEIGHT_PX + 8}px`,
        pointerEvents: 'none',
        zIndex: 5,
        overflow: 'hidden',
      }}
    >
      <div
        ref={camelRef}
        style={{
          position: 'absolute',
          bottom: 0,
          insetInlineStart: 0,
          width: `${SVG_W * (CAMEL_HEIGHT_PX / SVG_H)}px`,
          height: `${CAMEL_HEIGHT_PX}px`,
          opacity: 0.92,
          mixBlendMode: 'screen',
          pointerEvents: 'auto',
          cursor: 'pointer',
          transformOrigin: 'center bottom',
          willChange: 'transform',
        }}
      >
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          width="100%"
          height="100%"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: 'block' }}
        >
          <defs>
            <linearGradient id="camel-coat" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d8b079" />
              <stop offset="55%" stopColor="#c8964a" />
              <stop offset="100%" stopColor="#a37633" />
            </linearGradient>
            <linearGradient id="camel-coat-dark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a37633" />
              <stop offset="100%" stopColor="#7a541f" />
            </linearGradient>
          </defs>

          {/* The whole camel sits in this group so the body-bob `y` translate
              moves everything (legs are children too and pivot from their
              joint origins). Coordinates: ground at y=150. */}
          <g ref={bodyRef}>
            {/* --- Back legs (drawn first so they sit behind the body) ----- */}

            {/* Back-right leg (far side, slightly darker) */}
            <g
              ref={legBRRef}
              style={{
                transformBox: 'fill-box',
                transformOrigin: '50% 0%',
              }}
              transform="translate(178 95)"
            >
              <path
                d="M -3 0 C -2 18, -5 32, -2 50 C 0 54, 4 54, 5 50 C 7 32, 4 18, 3 0 Z"
                fill="url(#camel-coat-dark)"
              />
              <path d="M -2 48 L 6 48 L 8 54 L -4 54 Z" fill="#5c3e15" />
            </g>

            {/* Back-left leg (near side) */}
            <g
              ref={legBLRef}
              style={{
                transformBox: 'fill-box',
                transformOrigin: '50% 0%',
              }}
              transform="translate(168 96)"
            >
              <path
                d="M -3 0 C -2 18, -5 34, -2 52 C 0 56, 4 56, 5 52 C 7 34, 4 18, 3 0 Z"
                fill="url(#camel-coat)"
              />
              <path d="M -2 50 L 6 50 L 8 56 L -4 56 Z" fill="#5c3e15" />
            </g>

            {/* --- Body + hump ------------------------------------------- */}
            {/* Belly + back outline. Big curve up to the hump in the middle. */}
            <path
              d="
                M 70 95
                C 70 75, 78 60, 95 56
                C 105 54, 115 56, 122 58
                C 128 48, 138 38, 152 38
                C 168 38, 178 50, 180 64
                C 190 66, 200 72, 202 86
                C 202 94, 198 100, 188 100
                L 90 100
                C 76 100, 70 98, 70 95 Z
              "
              fill="url(#camel-coat)"
            />
            {/* Subtle shadow under the belly */}
            <path
              d="M 78 96 C 100 102, 160 102, 190 96 C 186 102, 100 104, 78 96 Z"
              fill="#7a541f"
              opacity="0.35"
            />
            {/* Hump highlight */}
            <path
              d="M 128 48 C 138 40, 160 40, 170 50 C 162 44, 138 44, 128 48 Z"
              fill="#e2c08c"
              opacity="0.7"
            />

            {/* --- Neck ------------------------------------------------- */}
            <path
              d="
                M 70 78
                C 56 70, 46 56, 44 42
                C 42 30, 48 22, 58 18
                C 60 22, 60 28, 58 34
                C 64 42, 70 56, 76 70
                Z
              "
              fill="url(#camel-coat)"
            />

            {/* --- Head (group, pivots at jaw) -------------------------- */}
            <g
              ref={headRef}
              style={{
                transformBox: 'fill-box',
                transformOrigin: '60% 80%',
              }}
              transform="translate(42 6)"
            >
              {/* Skull + snout */}
              <path
                d="
                  M 0 14
                  C -2 6, 4 -2, 14 0
                  C 22 2, 26 8, 26 16
                  C 26 20, 24 24, 20 26
                  C 24 28, 28 30, 30 34
                  C 32 38, 28 40, 22 40
                  C 16 40, 10 36, 4 32
                  C 0 28, -2 22, 0 14 Z
                "
                fill="url(#camel-coat)"
              />
              {/* Nostril */}
              <path d="M 26 32 C 28 32, 30 34, 28 36 C 26 36, 25 34, 26 32 Z" fill="#5c3e15" />
              {/* Mouth line */}
              <path
                d="M 18 36 C 22 38, 26 38, 30 36"
                stroke="#5c3e15"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              {/* Eye */}
              <ellipse cx="14" cy="14" rx="1.6" ry="1.2" fill="#2a1a08" />
              <circle cx="13.6" cy="13.7" r="0.4" fill="#fff" opacity="0.8" />
              {/* Eyelash hint */}
              <path
                d="M 12 12 C 13 11, 15 11, 16 12"
                stroke="#2a1a08"
                strokeWidth="0.8"
                strokeLinecap="round"
              />

              {/* Ear (its own group so we can flick it) */}
              <g
                ref={earRef}
                style={{
                  transformBox: 'fill-box',
                  transformOrigin: '50% 100%',
                }}
                transform="translate(6 -2)"
              >
                <path
                  d="M 0 6 C -2 -2, 6 -4, 8 2 C 8 6, 6 8, 4 8 C 2 8, 0 7, 0 6 Z"
                  fill="url(#camel-coat-dark)"
                />
                <path d="M 2 5 C 3 1, 6 0, 7 3 C 6 5, 4 6, 2 5 Z" fill="#f0d5a8" opacity="0.7" />
              </g>
            </g>

            {/* --- Front legs (drawn after body so they overlap correctly) */}

            {/* Front-right leg (far side) */}
            <g
              ref={legFRRef}
              style={{
                transformBox: 'fill-box',
                transformOrigin: '50% 0%',
              }}
              transform="translate(96 92)"
            >
              <path
                d="M -3 0 C -2 18, -5 32, -2 50 C 0 54, 4 54, 5 50 C 7 32, 4 18, 3 0 Z"
                fill="url(#camel-coat-dark)"
              />
              <path d="M -2 48 L 6 48 L 8 54 L -4 54 Z" fill="#5c3e15" />
            </g>

            {/* Front-left leg (near side) */}
            <g
              ref={legFLRef}
              style={{
                transformBox: 'fill-box',
                transformOrigin: '50% 0%',
              }}
              transform="translate(86 94)"
            >
              <path
                d="M -3 0 C -2 18, -5 34, -2 54 C 0 58, 4 58, 5 54 C 7 34, 4 18, 3 0 Z"
                fill="url(#camel-coat)"
              />
              <path d="M -2 52 L 6 52 L 8 58 L -4 58 Z" fill="#5c3e15" />
            </g>

            {/* --- Tail ------------------------------------------------- */}
            <path
              d="M 200 80 C 210 76, 214 82, 212 90 C 210 94, 208 92, 210 88 C 211 86, 210 82, 206 84"
              stroke="#7a541f"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="212" cy="92" r="1.5" fill="#5c3e15" />
          </g>
        </svg>
      </div>
    </div>
  )
}
