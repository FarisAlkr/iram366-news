'use client'

import React from 'react'
import { useDocumentInfo, useFormFields } from '@payloadcms/ui'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://iram366news.com').replace(/\/$/, '')

/**
 * One-tap WhatsApp share. Mounted as a `ui` field in the Articles sidebar.
 * Builds a `wa.me` deep-link with the article's title + canonical URL and
 * lets Adam pick his Channel from the standard WhatsApp share sheet.
 *
 * Disabled until the article is actually published — sharing a draft would
 * give followers a 404 since drafts return notFound on the public site.
 *
 * Pure deep-link, no APIs, no auth, no risk of being rate-limited or banned.
 * WhatsApp itself fetches the og:image / og:title from the URL when the
 * recipient opens the message.
 */
export const WhatsAppShare: React.FC = () => {
  const { id } = useDocumentInfo()

  const { title, slug, status } = useFormFields(([fields]) => ({
    title: fields?.title?.value,
    slug: fields?.slug?.value,
    status: fields?.status?.value,
  }))

  const isDraft = !id // form not yet saved
  const isPublished = status === 'published'
  const hasContent = typeof title === 'string' && typeof slug === 'string' && slug.length > 0

  // Stage 1: form is brand-new, not yet saved
  if (isDraft) {
    return (
      <div className="iram-wa-share iram-wa-share--idle">
        <span className="iram-wa-share__icon" aria-hidden>
          💬
        </span>
        <div className="iram-wa-share__body">
          <strong>📲 مشاركة على واتساب</strong>
          <small>احفظ ثم انشر المقال أولاً</small>
        </div>
      </div>
    )
  }

  // Stage 2: saved but not published
  if (!isPublished || !hasContent) {
    return (
      <div className="iram-wa-share iram-wa-share--pending">
        <span className="iram-wa-share__icon" aria-hidden>
          💬
        </span>
        <div className="iram-wa-share__body">
          <strong>📲 مشاركة على واتساب</strong>
          <small>متاح بعد تغيير الحالة إلى &ldquo;منشور&rdquo;</small>
        </div>
      </div>
    )
  }

  // Stage 3: published — build deep link
  const titleStr = String(title)
  const slugStr = String(slug)
  const url = `${SITE_URL}/articles/${slugStr}`
  const message = `${titleStr}\n\n${url}`
  const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="iram-wa-share iram-wa-share--ready"
      aria-label="مشاركة على واتساب"
    >
      <svg
        className="iram-wa-share__brand"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0 0 20.464 3.488" />
      </svg>
      <div className="iram-wa-share__body">
        <strong>📲 مشاركة على واتساب</strong>
        <small>اختر القناة وأرسل</small>
      </div>
      <span className="iram-wa-share__arrow" aria-hidden>
        ←
      </span>
    </a>
  )
}

export default WhatsAppShare
