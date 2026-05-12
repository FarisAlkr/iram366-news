'use client'

// See CursorInkMount.tsx — same reason. Next 15 + React Server Components
// require `ssr: false` to be declared from a Client Component.

import dynamic from 'next/dynamic'

const FooterCamel = dynamic(() => import('./FooterCamel'), { ssr: false })

export default function FooterCamelMount() {
  return <FooterCamel />
}
