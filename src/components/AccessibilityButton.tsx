'use client'

import Link from 'next/link'

/**
 * Accessibility entry point in the footer (Israeli Regulation 35).
 *
 * The button intentionally lives in the footer rather than as a fourth
 * floating action — the bottom-right is taken by the chatbot toggle and
 * the bottom-left by the social hub, so a third floating element would
 * stack and obscure them on small screens.
 *
 * Two behaviors:
 *
 *   • If the UserWay widget loaded (window.UserWay), pressing the button
 *     opens its accessibility panel. The widget itself is injected from
 *     (frontend)/layout.tsx when NEXT_PUBLIC_USERWAY_ACCOUNT_ID is set,
 *     with data-position=8 so it docks in the footer rather than floating.
 *
 *   • If UserWay is not available, the button still renders and links to
 *     /accessibility-statement so the user always has the legally-required
 *     escape hatch — falling back to plain HTML for the worst case.
 */
declare global {
  interface Window {
    UserWay?: {
      iconVisibilityOff?: () => void
      iconVisibilityOn?: () => void
      openWidget?: () => void
    }
  }
}

export function AccessibilityButton() {
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (typeof window === 'undefined') return
    if (window.UserWay?.openWidget) {
      event.preventDefault()
      window.UserWay.openWidget()
    }
  }

  return (
    <Link
      href="/accessibility-statement"
      onClick={handleClick}
      aria-label="إعدادات إمكانية الوصول · נגישות"
      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 transition-colors duration-150 hover:border-accent-gold hover:bg-accent-gold hover:text-navy"
    >
      <WheelchairIcon />
      <span>נגישות · إمكانية الوصول</span>
    </Link>
  )
}

function WheelchairIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="4" r="2" />
      <path d="M10 6v4l4 1 2 5" />
      <circle cx="14" cy="17" r="5" />
      <path d="M10 16h4" />
    </svg>
  )
}
