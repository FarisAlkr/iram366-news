import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'إرم 366 الإخبارية',
    short_name: 'إرم 366',
    description: 'منصة إخبارية مستقلة برؤية مختلفة — نواكب الأحداث لحظة بلحظة من رهط والنقب',
    start_url: '/',
    display: 'standalone',
    background_color: '#fafaf9',
    theme_color: '#0a2a2f',
    dir: 'rtl',
    lang: 'ar',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
