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
  whatsapp: {
    label: 'واتساب',
    bg: 'bg-[#25D366]/10',
    text: 'text-[#25D366]',
    hover: 'hover:bg-[#25D366]/20',
  },
  instagram: {
    label: 'انستغرام',
    bg: 'bg-[#E4405F]/10',
    text: 'text-[#E4405F]',
    hover: 'hover:bg-[#E4405F]/20',
  },
  tiktok: { label: 'تيك توك', bg: 'bg-ink/5', text: 'text-ink', hover: 'hover:bg-ink/10' },
  youtube: {
    label: 'يوتيوب',
    bg: 'bg-[#FF0000]/10',
    text: 'text-[#FF0000]',
    hover: 'hover:bg-[#FF0000]/20',
  },
  telegram: {
    label: 'تيليجرام',
    bg: 'bg-[#229ED9]/10',
    text: 'text-[#229ED9]',
    hover: 'hover:bg-[#229ED9]/20',
  },
  facebook: {
    label: 'فيسبوك',
    bg: 'bg-[#1877F2]/10',
    text: 'text-[#1877F2]',
    hover: 'hover:bg-[#1877F2]/20',
  },
} as const

type SocialKey = keyof typeof SOCIAL_BRAND

export function Sidebar({ mostRead, socialLinks }: SidebarProps) {
  const socialEntries = (Object.keys(SOCIAL_BRAND) as SocialKey[])
    .map((key) => ({ key, href: socialLinks?.[key] }))
    .filter((s): s is { key: SocialKey; href: string } => Boolean(s.href))

  return (
    <aside className="space-y-8">
      {socialEntries.length > 0 && (
        <div className="rounded-lg bg-surface p-5 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 flex items-center gap-2 font-display text-base font-bold">
            <span className="inline-block h-5 w-1 rounded-full bg-accent-gold" />
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
                  className={`flex items-center gap-2 rounded px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${brand.bg} ${brand.text} ${brand.hover}`}
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
        <div className="rounded-lg bg-surface p-5 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 flex items-center gap-2 font-display text-base font-bold">
            <span className="inline-block h-5 w-1 rounded-full bg-accent-red" />
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
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex-shrink-0 font-display text-2xl font-extrabold leading-none text-[var(--color-border-dark)]">
        {rank.toLocaleString('ar-EG')}
      </span>
      <Link href={`/articles/${article.slug}`} className="group flex flex-1 items-start gap-3">
        <div className="relative h-14 w-20 flex-shrink-0 overflow-hidden rounded">
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
        <div className="min-w-0 flex-1">
          <h4 className="line-clamp-2 font-display text-sm font-semibold leading-snug transition-colors duration-150 group-hover:text-accent-red">
            {article.title}
          </h4>
          {article.publishedAt && (
            <time className="mt-1 block text-xs text-[var(--color-ink-muted)]">
              {relativeTime(article.publishedAt)}
            </time>
          )}
        </div>
      </Link>
    </li>
  )
}
