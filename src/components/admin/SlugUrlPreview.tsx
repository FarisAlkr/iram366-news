'use client'

import React from 'react'
import { useDocumentInfo, useFormFields } from '@payloadcms/ui'

const SITE_HOST = (process.env.NEXT_PUBLIC_SITE_URL || 'https://iram366news.com')
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '')

type ConflictState =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available' }
  | { state: 'taken'; otherTitle?: string }
  | { state: 'invalid'; reason: string }

const VALID_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Live slug preview + conflict detection. Renders below the slug input
 * (wired as `admin.components.afterInput`).
 *
 * Validates format client-side (lowercase, hyphens, no spaces) and pings
 * /api/articles to check whether the slug is already taken — debounced 400ms.
 */
export const SlugUrlPreview: React.FC = () => {
  const { id } = useDocumentInfo()
  const slug = useFormFields(([fields]) => fields?.slug?.value)
  const value = typeof slug === 'string' ? slug.trim() : ''
  const currentId = typeof id === 'string' || typeof id === 'number' ? id : undefined

  const [conflict, setConflict] = React.useState<ConflictState>({ state: 'idle' })

  React.useEffect(() => {
    if (!value) {
      setConflict({ state: 'idle' })
      return
    }

    // Format check first (cheap, instant)
    if (!VALID_SLUG_RE.test(value)) {
      setConflict({
        state: 'invalid',
        reason:
          'الرابط يجب أن يتكون من أحرف لاتينية صغيرة وأرقام وشرطات فقط (لا مسافات)',
      })
      return
    }

    setConflict({ state: 'checking' })
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/articles?where[slug][equals]=${encodeURIComponent(value)}&limit=1&depth=0`,
          { signal: ctrl.signal },
        )
        if (!res.ok) {
          setConflict({ state: 'idle' })
          return
        }
        const json = (await res.json()) as { docs: Array<{ id: string | number; title?: string }> }
        const conflicting = json.docs?.find((d) => d.id !== currentId)
        if (conflicting) {
          setConflict({ state: 'taken', otherTitle: conflicting.title })
        } else {
          setConflict({ state: 'available' })
        }
      } catch {
        setConflict({ state: 'idle' })
      }
    }, 400)

    return () => {
      ctrl.abort()
      clearTimeout(t)
    }
  }, [value, currentId])

  return (
    <div className="iram-slug-preview-wrap" dir="rtl">
      <div className="iram-slug-preview" dir="ltr">
        <span className="iram-slug-preview__label">الرابط:</span>
        <span className="iram-slug-preview__url">
          <span className="iram-slug-preview__host">{SITE_HOST}/articles/</span>
          <span className="iram-slug-preview__slug" data-empty={!value || undefined}>
            {value || '...'}
          </span>
        </span>
      </div>
      {value && <SlugStatus conflict={conflict} />}
    </div>
  )
}

const SlugStatus: React.FC<{ conflict: ConflictState }> = ({ conflict }) => {
  switch (conflict.state) {
    case 'idle':
      return null
    case 'checking':
      return <p className="iram-slug-status iram-slug-status--checking">يتحقق من توفر الرابط...</p>
    case 'available':
      return (
        <p className="iram-slug-status iram-slug-status--ok">
          ✓ الرابط متاح وجاهز للاستخدام
        </p>
      )
    case 'taken':
      return (
        <p className="iram-slug-status iram-slug-status--bad">
          ✗ هذا الرابط مستخدم مسبقاً
          {conflict.otherTitle ? ` — للمقال: «${conflict.otherTitle}»` : ''} — جرّب رابطاً مختلفاً
        </p>
      )
    case 'invalid':
      return <p className="iram-slug-status iram-slug-status--bad">✗ {conflict.reason}</p>
  }
}

export default SlugUrlPreview
