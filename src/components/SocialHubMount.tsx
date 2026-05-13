'use client'

// Client-side mount shim, same pattern as CursorInkMount.tsx — Next 15
// forbids `dynamic({ ssr: false })` inside Server Components, so the
// dynamic import lives in this client wrapper. The wrapper itself is
// rendered from the (server) root layout and forwards the URLs that
// the server already fetched from siteSettings.

import dynamic from 'next/dynamic'

import type { SocialUrls } from './SocialHub'

const SocialHub = dynamic(() => import('./SocialHub'), { ssr: false })

export default function SocialHubMount({ urls }: { urls: SocialUrls }) {
  return <SocialHub urls={urls} />
}
