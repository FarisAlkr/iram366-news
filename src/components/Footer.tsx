import Link from 'next/link'

import type { Category, SiteSettings } from '@/types/payload'
import { SocialIcon } from './SocialIcon'

interface FooterProps {
  siteName: string
  footerText?: string | null
  socialLinks?: SiteSettings['socialLinks']
  categories: Pick<Category, 'name' | 'slug'>[]
}

interface SocialLink {
  href: string
  label: string
  brand: 'whatsapp' | 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'telegram'
}

function buildSocialLinks(links?: SiteSettings['socialLinks']): SocialLink[] {
  if (!links) return []
  const out: SocialLink[] = []
  if (links.whatsapp) out.push({ href: links.whatsapp, label: 'واتساب', brand: 'whatsapp' })
  if (links.instagram) out.push({ href: links.instagram, label: 'إنستغرام', brand: 'instagram' })
  if (links.tiktok) out.push({ href: links.tiktok, label: 'تيك توك', brand: 'tiktok' })
  if (links.youtube) out.push({ href: links.youtube, label: 'يوتيوب', brand: 'youtube' })
  if (links.telegram) out.push({ href: links.telegram, label: 'تيليجرام', brand: 'telegram' })
  if (links.facebook) out.push({ href: links.facebook, label: 'فيسبوك', brand: 'facebook' })
  return out
}

export function Footer({ siteName, footerText, socialLinks, categories }: FooterProps) {
  const social = buildSocialLinks(socialLinks)
  const email = socialLinks?.email

  return (
    <footer className="bg-navy text-white/90 mt-12">
      <div className="container-news py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-display font-extrabold text-xl mb-3 text-white">{siteName}</h3>
            <p className="text-sm leading-relaxed text-white/60">
              منصة إخبارية مستقلة برؤية مختلفة — نواكب الأحداث لحظة بلحظة من رهط والنقب
            </p>
          </div>

          <div>
            <h4 className="font-display font-bold text-sm mb-4 text-accent-gold">الأقسام</h4>
            <nav className="flex flex-col gap-2">
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className="text-sm text-white/60 hover:text-white transition-colors duration-150"
                >
                  {cat.name}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <h4 className="font-display font-bold text-sm mb-4 text-accent-gold">تواصل معنا</h4>

            {social.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {social.map((s) => (
                  <a
                    key={s.brand}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    title={s.label}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-accent-gold hover:text-navy text-white/80 transition-colors duration-150"
                  >
                    <SocialIcon brand={s.brand} size={20} />
                  </a>
                ))}
              </div>
            )}

            {email && (
              <a
                href={`mailto:${email}`}
                className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors duration-150"
              >
                <SocialIcon brand="email" size={16} />
                <span>{email}</span>
              </a>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-6 text-center text-xs text-white/40 space-y-1">
          <div>
            {footerText || `جميع الحقوق محفوظة © ${new Date().getFullYear()} لشركة إرم 366 الإخبارية م.ض`}
          </div>
          <div className="text-[11px]">
            تطوير: <span className="iram-credit-shine">فارس القريناوي · Faris Alkrenawe</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
