'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'

const SITE_HOST = (process.env.NEXT_PUBLIC_SITE_URL || 'https://iram366news.com')
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '')

const TITLE_RANGE = { min: 50, max: 60, hardMax: 70 }
const DESC_RANGE = { min: 120, max: 155, hardMax: 160 }

type Tone = 'good' | 'warn' | 'over'

function tone(len: number, range: { min: number; max: number; hardMax: number }): Tone {
  if (len === 0) return 'warn'
  if (len > range.hardMax) return 'over'
  if (len < range.min || len > range.max) return 'warn'
  return 'good'
}

function trim(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max - 1) + '…'
}

function pickString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Live SEO + social preview shown on the SEO tab. Renders a Google search
 * snippet, a WhatsApp/Facebook share card, and tone-coded character counters.
 */
export const SeoPreview: React.FC = () => {
  const fields = useFormFields(([all]) => ({
    title: pickString(all?.title?.value),
    excerpt: pickString(all?.excerpt?.value),
    slug: pickString(all?.slug?.value),
    seoTitle: pickString(all?.seoTitle?.value),
    seoDescription: pickString(all?.seoDescription?.value),
  }))

  const effectiveTitle = (fields.seoTitle || fields.title || 'عنوان المقال').trim()
  const effectiveDesc = (
    fields.seoDescription ||
    fields.excerpt ||
    'سيظهر هنا وصف المقال كما يراه القارئ في نتائج جوجل ومنصات التواصل.'
  ).trim()
  const url = `${SITE_HOST}/articles/${fields.slug || '...'}`

  const titleTone = tone(effectiveTitle.length, TITLE_RANGE)
  const descTone = tone(effectiveDesc.length, DESC_RANGE)

  return (
    <div className="iram-seo" dir="rtl">
      <div className="iram-seo__header">
        <h4 className="iram-seo__heading">معاينة مباشرة</h4>
        <p className="iram-seo__subheading">
          هكذا يظهر مقالك في نتائج جوجل وعند مشاركته على واتساب أو فيسبوك.
        </p>
      </div>

      <div className="iram-seo__cards">
        {/* Google snippet */}
        <div className="iram-seo__card iram-seo__card--google" dir="ltr">
          <div className="iram-seo__card-label">Google</div>
          <div className="iram-seo__google">
            <div className="iram-seo__google-meta">
              <div className="iram-seo__google-favicon" aria-hidden>
                إ
              </div>
              <div>
                <div className="iram-seo__google-site">إرم 366 الإخبارية</div>
                <div className="iram-seo__google-url">{trim(url, 80)}</div>
              </div>
            </div>
            <div className="iram-seo__google-title" dir="rtl">
              {trim(effectiveTitle, 70)}
            </div>
            <div className="iram-seo__google-desc" dir="rtl">
              {trim(effectiveDesc, 160)}
            </div>
          </div>
        </div>

        {/* Social share card */}
        <div className="iram-seo__card iram-seo__card--social">
          <div className="iram-seo__card-label">واتساب · فيسبوك</div>
          <div className="iram-seo__social">
            <div className="iram-seo__social-image" aria-hidden>
              <span>📰</span>
            </div>
            <div className="iram-seo__social-body">
              <div className="iram-seo__social-host" dir="ltr">
                {SITE_HOST}
              </div>
              <div className="iram-seo__social-title">{trim(effectiveTitle, 90)}</div>
              <div className="iram-seo__social-desc">{trim(effectiveDesc, 200)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="iram-seo__counters">
        <Counter
          label="طول العنوان"
          length={effectiveTitle.length}
          range={TITLE_RANGE}
          tone={titleTone}
        />
        <Counter
          label="طول الوصف"
          length={effectiveDesc.length}
          range={DESC_RANGE}
          tone={descTone}
        />
      </div>
    </div>
  )
}

interface CounterProps {
  label: string
  length: number
  range: { min: number; max: number; hardMax: number }
  tone: Tone
}

const Counter: React.FC<CounterProps> = ({ label, length, range, tone }) => {
  const fmt = (n: number) => n.toLocaleString('ar-EG-u-nu-latn')
  const message =
    tone === 'good'
      ? 'مثالي'
      : tone === 'over'
        ? `تجاوز الحد الأقصى (${fmt(range.hardMax)} حرف)`
        : length === 0
          ? 'لم يُكتب بعد'
          : length < range.min
            ? `قصير — أضف ${fmt(range.min - length)} حرفاً على الأقل`
            : `قريب من الحد الأقصى — أزل ${fmt(length - range.max)} حرفاً`

  const pct = Math.min(100, Math.round((length / range.hardMax) * 100))

  return (
    <div className={`iram-seo__counter iram-seo__counter--${tone}`}>
      <div className="iram-seo__counter-row">
        <span className="iram-seo__counter-label">{label}</span>
        <span className="iram-seo__counter-len">
          {fmt(length)} <span>/ {fmt(range.hardMax)}</span>
        </span>
      </div>
      <div className="iram-seo__counter-track">
        <div className="iram-seo__counter-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="iram-seo__counter-msg">{message}</div>
    </div>
  )
}

export default SeoPreview
