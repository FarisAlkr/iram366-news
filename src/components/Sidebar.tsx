import Image from 'next/image'
import Link from 'next/link'

import { relativeTime } from '@/lib/date'
import type { Article, Media, SiteSettings } from '@/types/payload'
import { resolveRef, pickMediaUrl } from '@/types/payload'
import { SocialIcon } from './SocialIcon'

export interface SidebarArticle {
  title: string
  slug: string
  featuredImage?: Article['featuredImage']
  publishedAt?: string | null
}

interface SidebarProps {
  mostRead: SidebarArticle[]
  socialLinks?: SiteSettings['socialLinks']
}

const SOCIAL_BRAND = {
  whatsapp: { label: 'واتساب', bg: 'bg-[#25D366]/10', text: 'text-[#25D366]', hover: 'hover:bg-[#25D366]/20' },
  instagram: { label: 'انستغرام', bg: 'bg-[#E4405F]/10', text: 'text-[#E4405F]', hover: 'hover:bg-[#E4405F]/20' },
  tiktok: { label: 'تيك توك', bg: 'bg-ink/5', text: 'text-ink', hover: 'hover:bg-ink/10' },
  youtube: { label: 'يوتيوب', bg: 'bg-[#FF0000]/10', text: 'text-[#FF0000]', hover: 'hover:bg-[#FF0000]/20' },
  telegram: { label: 'تيليجرام', bg: 'bg-[#229ED9]/10', text: 'text-[#229ED9]', hover: 'hover:bg-[#229ED9]/20' },
  facebook: { label: 'فيسبوك', bg: 'bg-[#1877F2]/10', text: 'text-[#1877F2]', hover: 'hover:bg-[#1877F2]/20' },
} as const

type SocialKey = keyof typeof SOCIAL_BRAND

export function Sidebar({ mostRead, socialLinks }: SidebarProps) {
  const socialEntries = (Object.keys(SOCIAL_BRAND) as SocialKey[])
    .map((key) => ({ key, href: socialLinks?.[key] }))
    .filter((s): s is { key: SocialKey; href: string } => Boolean(s.href))

  return (
    <aside className="space-y-8">
      {socialEntries.length > 0 && (
        <div className="bg-white rounded-lg p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display font-bold text-base mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-accent-gold rounded-full inline-block" />
            تابعنا
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {socialEntries.map(({ key, href }) => {
              const brand = SOCIAL_BRAND[key]
              return (
                <a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={brand.label}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded text-sm font-medium transition-colors duration-150 ${brand.bg} ${brand.text} ${brand.hover}`}
                >
                  <SocialIcon brand={key} size={18} />
                  <span>{brand.label}</span>
                </a>
              )
            })}
          </div>
        </div>
      )}

      {mostRead.length > 0 && (
        <div className="bg-white rounded-lg p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display font-bold text-base mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-accent-red rounded-full inline-block" />
            الأكثر قراءة
          </h3>
          <ol className="space-y-4">
            {mostRead.map((article, i) => (
              <MostReadItem key={article.slug} article={article} rank={i + 1} />
            ))}
          </ol>
        </div>
      )}
    </aside>
  )
}

function MostReadItem({ article, rank }: { article: SidebarArticle; rank: number }) {
  const image = resolveRef<Media>(article.featuredImage ?? null)
  return (
    <li className="flex gap-3 items-start">
      <span className="text-2xl font-display font-extrabold text-[var(--color-border-dark)] flex-shrink-0 leading-none mt-0.5">
        {rank.toLocaleString('ar-EG')}
      </span>
      <Link href={`/articles/${article.slug}`} className="group flex-1 flex gap-3 items-start">
        <div className="relative w-20 h-14 flex-shrink-0 overflow-hidden rounded">
          {image && (
            <Image
              src={pickMediaUrl(image, 'thumbnail')}
              alt={image.alt || article.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="80px"
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-display font-semibold text-sm leading-snug line-clamp-2 group-hover:text-accent-red transition-colors duration-150">
            {article.title}
          </h4>
          {article.publishedAt && (
            <time className="text-[var(--color-ink-muted)] text-xs mt-1 block">
              {relativeTime(article.publishedAt)}
            </time>
          )}
        </div>
      </Link>
    </li>
  )
}
