'use client'

// Client-side mount shim. Next 15 forbids `dynamic({ ssr: false })` inside
// Server Components, so the dynamic import lives in this client wrapper
// instead. The wrapper itself is rendered from the (server) root layout.

import dynamic from 'next/dynamic'

const CursorInk = dynamic(() => import('./CursorInk'), { ssr: false })

export default function CursorInkMount() {
  return <CursorInk />
}
