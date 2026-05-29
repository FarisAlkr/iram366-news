'use client'

// See CursorInkMount.tsx / FooterCamelMount.tsx — same reason. Next 15
// + React Server Components require `ssr: false` to be declared from a
// Client Component, so the dynamic import lives in this client wrapper.

import dynamic from 'next/dynamic'

const FallingSheep = dynamic(() => import('./FallingSheep'), { ssr: false })

export default function FallingSheepMount() {
  return <FallingSheep />
}
