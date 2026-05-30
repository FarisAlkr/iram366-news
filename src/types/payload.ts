/**
 * App-level types over Payload's generic responses.
 *
 * Payload's auto-generated payload-types.ts mirrors the schema but does not
 * encode whether a relationship/upload field has been *populated* (i.e.
 * fetched with depth>=1). The types in this file describe the shape we
 * actually consume in the UI: relationships are objects, image sizes are
 * present, etc.
 *
 * Anything fetched with `depth: 0` should NOT use these types — query the
 * raw Payload type and hydrate first.
 */

import type { ArticleStatus, HeroMode, UserRole } from '@/domain/enums'

// --------------------------------------------------------------------------
// Primitives
// --------------------------------------------------------------------------

export type Id = number | string

/** A relationship that may be either a populated object or a bare id reference. */
export type Ref<T> = T | Id

/** Resolve a Ref<T> down to T or undefined. */
export function resolveRef<T extends { id: Id }>(ref: Ref<T> | null | undefined): T | undefined {
  if (ref == null) return undefined
  if (typeof ref === 'object') return ref as T
  return undefined
}

// --------------------------------------------------------------------------
// Media
// --------------------------------------------------------------------------

export interface MediaSize {
  url: string
  width?: number
  height?: number
}

export interface Media {
  id: Id
  url: string
  alt: string
  caption?: string | null
  filename?: string
  mimeType?: string
  width?: number
  height?: number
  sizes?: {
    thumbnail?: MediaSize
    card?: MediaSize
    hero?: MediaSize
    full?: MediaSize
  }
}

/** Pick the best size for a given context, falling back to the original. */
export function pickMediaUrl(
  media: Media | null | undefined,
  preferred: keyof NonNullable<Media['sizes']> = 'card',
): string {
  if (!media) return ''
  return media.sizes?.[preferred]?.url || media.url || ''
}

// --------------------------------------------------------------------------
// Categories
// --------------------------------------------------------------------------

export interface Category {
  id: Id
  name: string
  slug: string
  description?: string | null
  color?: string | null
}

// --------------------------------------------------------------------------
// Users
// --------------------------------------------------------------------------

export interface User {
  id: Id
  name: string
  email: string
  role: UserRole
  avatar?: Ref<Media> | null
}

// --------------------------------------------------------------------------
// Articles
// --------------------------------------------------------------------------

export interface ArticleTag {
  tag: string
}

/** A single image in the article's optional gallery. */
export interface GalleryImage {
  image: Ref<Media>
  caption?: string | null
  credit?: string | null
}

/** Article shape for UI consumption — relationships populated. */
export interface Article {
  id: Id
  title: string
  slug: string
  excerpt: string
  body: unknown
  videoUrl?: string | null
  featuredImage?: Ref<Media> | null
  ogImage?: Ref<Media> | null
  category?: Ref<Category> | null
  author?: Ref<User> | null
  tags?: ArticleTag[] | null
  gallery?: GalleryImage[] | null
  status: ArticleStatus
  publishedAt?: string | null
  isFeatured?: boolean
  isBreaking?: boolean
  views?: number
  readingTime?: number
  seoTitle?: string | null
  seoDescription?: string | null
  seoKeywords?: string | null
  createdAt: string
  updatedAt: string
}

// --------------------------------------------------------------------------
// Site settings
// --------------------------------------------------------------------------

export type AnnouncementVariant = 'info' | 'warning' | 'danger' | 'promo'

export interface SiteSettings {
  siteName?: string | null
  siteDescription?: string | null
  logo?: Ref<Media> | null
  socialLinks?: {
    whatsapp?: string | null
    instagram?: string | null
    tiktok?: string | null
    youtube?: string | null
    telegram?: string | null
    facebook?: string | null
    email?: string | null
  } | null
  announcement?: {
    show?: boolean
    message?: string | null
    variant?: AnnouncementVariant
    link?: string | null
    dismissible?: boolean
  } | null
  homepageHero?: {
    mode: HeroMode
    mainArticle?: Ref<Article> | null
    secondaryArticles?: Ref<Article>[] | null
  } | null
  footerText?: string | null
  signatureUi?: {
    enableCursorInk?: boolean
    enableFooterCamel?: boolean
    enableEidSheep?: boolean
  } | null
  socialHub?: {
    enabled?: boolean
  } | null
}
