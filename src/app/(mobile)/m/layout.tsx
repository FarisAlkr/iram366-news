import type { Metadata, Viewport } from 'next'
import React from 'react'
import { IBM_Plex_Sans_Arabic, Noto_Kufi_Arabic } from 'next/font/google'
import '../../globals.css'
import './mobile.css'

const ibmPlex = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-ibm',
  display: 'swap',
})

const notoKufi = Noto_Kufi_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-kufi',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'إرم 366 — لوحة الجوال',
  description: 'لوحة تحكم مبسّطة للنشر من الجوال',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0a2a2f',
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${ibmPlex.variable} ${notoKufi.variable}`}>
      <body className="m-app">{children}</body>
    </html>
  )
}
