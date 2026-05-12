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

import { useEffect, useRef, useState } from 'react'
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

  // Click → bow → smile + speech bubble. `isGreeting` controls whether the
  // bubble exists; `isSmiling` swaps the mouth path. They're set together
  // but tracked separately so dismiss can clear the bubble while letting
  // the smile linger (or vice versa) if we ever want that.
  const [isSmiling, setIsSmiling] = useState(false)
  const [isGreeting, setIsGreeting] = useState(false)
  // Two-phase mount for the fade transition: bubbleMounted controls DOM
  // presence; bubbleVisible toggles the opacity-1 class. Order:
  //   greet  → mount, next frame → visible (fade-in plays)
  //   dismiss → visible off, 200ms later → unmount (fade-out completes
  //              before the element leaves the DOM).
  const [bubbleMounted, setBubbleMounted] = useState(false)
  const [bubbleVisible, setBubbleVisible] = useState(false)
  const bubbleRef = useRef<HTMLDivElement | null>(null)

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

    // Fire-and-forget GSAP animations (sniff, ear-flick, bow, onLeave reset)
    // accumulate here so cleanup can kill any still in flight at unmount.
    const ephemerals: gsap.core.Animation[] = []
    // Head-tracking creates a new tween per rAF tick while paused; we keep
    // only the latest reference (the prior one is killed before the new one
    // is created) so we don't grow an unbounded array.
    let headTrackTween: gsap.core.Tween | null = null

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
      // Guard against a 0-width wrapper (the initial paint can fire before
      // the footer has its real dimensions). Without this the camel would
      // sit still at left: 0 with no motion at all.
      const stepDuration = travel > 0 ? travel / WALK_PX_PER_SEC : 1

      // Start the camel at the visual right edge facing left (scaleX = 1
      // matches the SVG's default head-on-the-left orientation, so the
      // camel walks "forward" during the right→left segment).
      gsap.set(camel, { x: travel, scaleX: 1 })
      directionFacing = 1

      // One full loop: walk right→left, dwell, turn to face right, walk
      // left→right, dwell, turn back. `repeat: -1` cycles continuously so
      // the camel is always somewhere visible inside the wrapper.
      const tl = gsap.timeline({ repeat: -1, paused: reducedMotion })
      tl.to(camel, { x: 0, duration: stepDuration, ease: 'none' })
        .to({}, { duration: EDGE_PAUSE_SEC }) // dwell at left edge
        .call(() => {
          directionFacing = -1
          gsap.to(camel, { scaleX: -1, duration: TURN_SEC, ease: 'power2.inOut' })
        })
        .to({}, { duration: TURN_SEC })
        .to(camel, { x: travel, duration: stepDuration, ease: 'none' })
        .to({}, { duration: EDGE_PAUSE_SEC }) // dwell at right edge
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
      const tl = gsap
        .timeline()
        .to(head, { rotate: 14, y: 4, duration: 0.5, ease: 'power2.out' })
        .to(head, { rotate: 14, y: 4, duration: 0.6 }) // hold (sniff)
        .to(head, { rotate: 0, y: 0, duration: 0.5, ease: 'power2.inOut' })
      ephemerals.push(tl)
    }

    const playEarFlick = () => {
      if (reducedMotion) return
      const tl = gsap
        .timeline()
        .to(ear, { rotate: -22, duration: 0.12, ease: 'power2.out' })
        .to(ear, { rotate: 0, duration: 0.18, ease: 'power2.in' })
        .to(ear, { rotate: -14, duration: 0.1, ease: 'power2.out' })
        .to(ear, { rotate: 0, duration: 0.18, ease: 'power2.in' })
      ephemerals.push(tl)
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
    // Under prefers-reduced-motion the idle behaviors are no-ops (playSniff /
    // playEarFlick early-return). Skip the setTimeout chain entirely so we
    // don't keep waking the event loop every 30-90s for nothing.
    if (!reducedMotion) scheduleIdle()

    // --- Cursor head-tracking (only when paused / at edge) ----------------

    let lastCursorX = 0
    const onMouseMove = (e: MouseEvent) => {
      lastCursorX = e.clientX
    }
    // Head-tracking is disabled under reduced motion, so the cursor position
    // is never consumed — don't bother subscribing in that mode.
    if (!reducedMotion) window.addEventListener('mousemove', onMouseMove, { passive: true })

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
        headTrackTween?.kill()
        headTrackTween = gsap.to(head, {
          rotate: visual,
          duration: HEAD_TRACK_DURATION,
          ease: 'power2.out',
        })
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
      ephemerals.push(gsap.to(head, { rotate: 0, duration: 0.4, ease: 'power2.out' }))
    }
    const onClick = () => {
      // Bow head ~10deg, hold 400ms, release. On bow completion, smile +
      // greet — the camel "says" السلام عليكم via the speech bubble. The
      // bow-then-greet sequencing is intentional: the bow reads as the
      // camel acknowledging the click before "speaking."
      const tl = gsap
        .timeline({
          onComplete: () => {
            setIsSmiling(true)
            setIsGreeting(true)
          },
        })
        .to(head, { rotate: 14, duration: 0.18, ease: 'power2.out' })
        .to(head, { rotate: 14, duration: 0.4 })
        .to(head, { rotate: 0, duration: 0.25, ease: 'power2.inOut' })
      ephemerals.push(tl)

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
      ephemerals.forEach((a) => a.kill())
      headTrackTween?.kill()
      window.removeEventListener('mousemove', onMouseMove)
      camel.removeEventListener('pointerenter', onEnter)
      camel.removeEventListener('pointerleave', onLeave)
      camel.removeEventListener('click', onClick)
    }
  }, [])

  // Bubble lifecycle: mount on greet, set visible next frame so the
  // opacity-1 transition plays; on dismiss, hide first then unmount after
  // the 200ms fade finishes.
  useEffect(() => {
    if (isGreeting) {
      setBubbleMounted(true)
      const id = requestAnimationFrame(() => setBubbleVisible(true))
      return () => cancelAnimationFrame(id)
    }
    setBubbleVisible(false)
    const id = window.setTimeout(() => setBubbleMounted(false), 200)
    return () => window.clearTimeout(id)
  }, [isGreeting])

  // While the bubble is in the DOM, follow the camel's **head** position
  // each frame. The head and body sit at different x's in the SVG: head
  // group origin is translate(42 6) and the head path centers around
  // x=57 in the 0..260 viewBox. That's a ratio of ~0.219 from the camel
  // wrapper's left edge when the camel faces left (scaleX = 1), and the
  // mirror image (~0.781) when it faces right (scaleX = -1).
  //
  // gsap.getProperty returns the *current* animated scaleX, including
  // intermediate values during a turn — we interpolate the head ratio
  // smoothly so the bubble slides over the camel's center while the
  // turn animation foreshortens the body, instead of snapping.
  useEffect(() => {
    if (!bubbleMounted) return
    const bubble = bubbleRef.current
    const camel = camelRef.current
    const wrap = wrapRef.current
    if (!bubble || !camel || !wrap) return

    const HEAD_RATIO_FACING_LEFT = 57 / 260 // ≈ 0.219

    let rafId = 0
    const update = () => {
      const camelRect = camel.getBoundingClientRect()
      const wrapRect = wrap.getBoundingClientRect()
      const scaleX = (gsap.getProperty(camel, 'scaleX') as number) ?? 1
      // Map scaleX ∈ [1, -1] → flippedFactor ∈ [0, 1].
      const flippedFactor = (1 - scaleX) / 2
      const effectiveRatio =
        HEAD_RATIO_FACING_LEFT + flippedFactor * (1 - 2 * HEAD_RATIO_FACING_LEFT)
      const headCenterX = camelRect.left - wrapRect.left + camelRect.width * effectiveRatio
      bubble.style.left = `${headCenterX}px`
      rafId = window.requestAnimationFrame(update)
    }
    update()
    return () => window.cancelAnimationFrame(rafId)
  }, [bubbleMounted])

  // Dismiss the greeting when the user clicks anywhere outside the camel
  // or the bubble. The listener is only attached while `isGreeting` is
  // true; cleanup removes it the moment the greeting flips off, so we
  // don't accumulate stacked listeners across multiple greet cycles.
  //
  // We listen on `mousedown` rather than `click` so the dismiss happens
  // before any other click handlers downstream (e.g. links inside the
  // footer) — that prevents the bubble from briefly persisting through
  // a navigation away from this page.
  useEffect(() => {
    if (!isGreeting) return
    const onOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node | null
      const camel = camelRef.current
      const bubble = bubbleRef.current
      if (!target) return
      if (camel && camel.contains(target)) return
      if (bubble && bubble.contains(target)) return
      setIsGreeting(false)
      setIsSmiling(false)
    }
    // Defer attach by one frame so the click that *started* the greeting
    // doesn't immediately dismiss it (the click bubbles up to document
    // after the onClick handler resolves).
    const id = requestAnimationFrame(() => {
      document.addEventListener('mousedown', onOutsideClick)
    })
    return () => {
      cancelAnimationFrame(id)
      document.removeEventListener('mousedown', onOutsideClick)
    }
  }, [isGreeting])

  return (
    <div
      ref={wrapRef}
      // The wrapper isn't aria-hidden anymore: the speech bubble inside
      // carries Arabic text that should be read by screen readers when
      // it's mounted (mounting is gated on a user-initiated click).
      style={{
        position: 'absolute',
        inset: 0,
        bottom: 0,
        top: 'auto',
        height: `${CAMEL_HEIGHT_PX + 8}px`,
        pointerEvents: 'none',
        zIndex: 5,
        // `visible` (not `hidden`) so the speech bubble can extend above
        // the wrapper into the footer content area. The camel itself
        // never extends outside the wrapper's bounds, so visible doesn't
        // change its rendering.
        overflow: 'visible',
      }}
    >
      <div
        ref={camelRef}
        style={{
          position: 'absolute',
          bottom: 0,
          // `left` (physical), NOT `insetInlineStart` (logical). The page is
          // dir="rtl" so insetInlineStart resolves to `right: 0`, anchoring
          // the wrapper at the visual right edge. GSAP's positive `x` then
          // translates further right — off-screen. The camel is decorative
          // and lives in pixel space, so physical `left: 0` is the correct
          // anchor regardless of writing direction.
          left: 0,
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
              {/* Mouth: neutral curve by default, gentle smile arc while
                  the greeting is active. Endpoints stay anchored at
                  (18, 36/38) and (30, 36/38) so the lip corners don't
                  visibly translate when the path swaps; only the control
                  points' Y values flip across the line to invert the
                  curve direction. */}
              <path
                d={isSmiling ? 'M 18 38 C 22 33, 26 33, 30 38' : 'M 18 36 C 22 38, 26 38, 30 36'}
                stroke="#5c3e15"
                strokeWidth="1.2"
                strokeLinecap="round"
                fill="none"
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

      {bubbleMounted && (
        <div
          ref={bubbleRef}
          className={
            bubbleVisible ? 'iram-camel-cloud iram-camel-cloud--visible' : 'iram-camel-cloud'
          }
          // `bottom` puts the cloud's tail tip just above the camel's
          // head (head/ear top sits at ~viewBox y=0 → 0px from camel
          // top → 86px from wrap bottom). +10px gap above that. `left`
          // is updated each frame by the position-follow effect so the
          // cloud tracks the head as the camel walks/turns.
          style={{ bottom: `${CAMEL_HEIGHT_PX + 10}px` }}
          dir="rtl"
          lang="ar"
          role="status"
          aria-live="polite"
        >
          <svg
            className="iram-camel-cloud__shape"
            viewBox="0 0 100 60"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {/* Cloud body: four overlapping ellipses form a bumpy
                silhouette. All fill="white", no stroke; the SVG's
                drop-shadow filter computes shadow off the combined
                alpha mask so internal seams don't show. */}
            <g fill="#ffffff">
              <ellipse cx="26" cy="28" rx="15" ry="13" />
              <ellipse cx="48" cy="20" rx="20" ry="15" />
              <ellipse cx="72" cy="26" rx="16" ry="13" />
              <ellipse cx="50" cy="32" rx="24" ry="11" />
              {/* Teardrop tail pointing down toward the camel's head.
                  Soft curve sides so it reads as a tail and not a
                  hard triangle. */}
              <path d="M 44 36 Q 47 50, 50 52 Q 53 50, 56 36 Z" />
            </g>
          </svg>
          <span className="iram-camel-cloud__text">السلام عليكم</span>
        </div>
      )}
    </div>
  )
}
