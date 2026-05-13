import type { Metadata, Viewport } from 'next'
import React from 'react'
import { Amiri, IBM_Plex_Sans_Arabic, Noto_Kufi_Arabic } from 'next/font/google'
import '../globals.css'

import { BackToHomeFallback } from '@/components/BackToHomeFallback'
import { Chatbot } from '@/components/Chatbot'
import CursorInkMount from '@/components/CursorInkMount'
import { ScrollProgress } from '@/components/ScrollProgress'
import SocialHubMount from '@/components/SocialHubMount'
import { SplashScreen } from '@/components/SplashScreen'
import { getSiteSettings } from '@/lib/queries'

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

// Amiri is a classical Naskh-style Arabic display face used by the cursor
// letter-trail effect. `preload: false` keeps it off the LCP critical path
// — the trail is a client-only, desktop-only signature touch, so loading
// the font before first paint would penalize mobile and slow networks for
// a feature they'll never see.
const amiri = Amiri({
  subsets: ['arabic'],
  weight: ['700'],
  variable: '--font-cursor-arabic',
  display: 'swap',
  preload: false,
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const metadata: Metadata = {
  // Without this, Next.js prefixes relative og:image / twitter:image URLs
  // with `http://localhost:3000` as a default. Setting it explicitly so
  // share previews on WhatsApp / Facebook / Twitter resolve to the right
  // host instead of localhost.
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'إرم 366 الإخبارية',
    template: '%s | إرم 366 الإخبارية',
  },
  description: 'منصة إخبارية مستقلة برؤية مختلفة — نواكب الأحداث لحظة بلحظة من رهط والنقب',
  authors: [{ name: 'Faris Alkrenawe' }],
  creator: 'Faris Alkrenawe',
  icons: {
    icon: '/logo.jpeg',
    apple: '/logo.jpeg',
    shortcut: '/logo.jpeg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5, // allow accessibility zoom; don't lock at 1
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafaf9' },
    { media: '(prefers-color-scheme: dark)', color: '#0a2a2f' },
  ],
}

const CF_ANALYTICS_TOKEN = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN

// Env flag is the hard kill-switch (build-time). Admin toggle is the runtime
// control. Both must be enabled for the effect to render. Env defaults to
// enabled — only `=== 'false'` disables.
const cursorInkEnvOn = process.env.NEXT_PUBLIC_FEATURE_CURSOR_INK !== 'false'
const socialHubEnvOn = process.env.NEXT_PUBLIC_FEATURE_SOCIAL_HUB !== 'false'

export default async function FrontendLayout({ children }: { children: React.ReactNode }) {
  const siteSettings = await getSiteSettings()
  const cursorInkAdminOn = siteSettings.signatureUi?.enableCursorInk !== false
  const showCursorInk = cursorInkEnvOn && cursorInkAdminOn
  const socialHubAdminOn = siteSettings.socialHub?.enabled !== false
  const showSocialHub = socialHubEnvOn && socialHubAdminOn
  // Pass only the platforms the hub surfaces. YouTube and email stay
  // in the CMS — YouTube is intentionally hidden from this hub (the
  // footer link list handles it); email is a different channel
  // (mailto:) handled elsewhere.
  const socialUrls = {
    whatsapp: siteSettings.socialLinks?.whatsapp ?? null,
    facebook: siteSettings.socialLinks?.facebook ?? null,
    instagram: siteSettings.socialLinks?.instagram ?? null,
    telegram: siteSettings.socialLinks?.telegram ?? null,
    tiktok: siteSettings.socialLinks?.tiktok ?? null,
  }

  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${ibmPlex.variable} ${notoKufi.variable} ${amiri.variable}`}
    >
      <body className="bg-cream font-body text-ink antialiased">
        <SplashScreen siteName="إرم 366 الإخبارية" />
        <BackToHomeFallback />
        <ScrollProgress />
        {children}
        <Chatbot />
        {/* Cloudflare Web Analytics — privacy-first, no cookies, no banner.
            The beacon is public per CF design (token is visible in page HTML
            anyway). Loaded as `defer` so it never blocks rendering. */}
        {CF_ANALYTICS_TOKEN && (
          <script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: CF_ANALYTICS_TOKEN })}
          />
        )}
        {showCursorInk && <CursorInkMount />}
        {showSocialHub && <SocialHubMount urls={socialUrls} />}
      </body>
    </html>
  )
}
