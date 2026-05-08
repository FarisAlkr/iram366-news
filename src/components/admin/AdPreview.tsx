'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'

const PLACEMENT_LABEL: Record<string, string> = {
  'header-banner': 'بانر علوي',
  'sidebar-top': 'الشريط الجانبي — أعلى',
  'sidebar-bottom': 'الشريط الجانبي — أسفل',
  'between-articles': 'بين المقالات',
  'article-inline': 'داخل المقال',
  'article-end': 'تحت المقال',
  footer: 'تذييل الصفحة',
}

interface ImageRef {
  url?: string
  alt?: string | null
}

function pickString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function pickImage(v: unknown): ImageRef | null {
  if (!v || typeof v !== 'object') return null
  const o = v as { url?: string; alt?: string | null }
  if (typeof o.url !== 'string') return null
  return { url: o.url, alt: o.alt ?? null }
}

/**
 * Live preview shown at the top of the Ads form. Two panels:
 *   1. Page-layout diagram with the selected placement highlighted
 *   2. The ad itself rendered exactly as it'll look on the public site
 *
 * Wired as a `ui` field at the top of the Ads collection so editors see
 * exactly where their ad lands before saving.
 */
export const AdPreview: React.FC = () => {
  const fields = useFormFields(([all]) => ({
    image: all?.image?.value,
    imageMobile: all?.imageMobile?.value,
    headline: pickString(all?.headline?.value),
    bodyText: pickString(all?.bodyText?.value),
    ctaText: pickString(all?.ctaText?.value) || 'اعرف أكثر',
    sponsoredLabel: all?.sponsoredLabel?.value !== false,
    placement: pickString(all?.placement?.value) || 'header-banner',
    advertiser: pickString(all?.advertiser?.value),
  }))

  const image = pickImage(fields.image)
  const placementLabel = PLACEMENT_LABEL[fields.placement] || fields.placement

  return (
    <div className="iram-adp" dir="rtl">
      <div className="iram-adp__head">
        <h4 className="iram-adp__heading">📍 معاينة مكان الظهور</h4>
        <p className="iram-adp__subheading">
          اختر مكان الظهور من الشريط الجانبي. سترى أين سيظهر الإعلان وكيف سيبدو
          للقارئ — قبل الحفظ.
        </p>
      </div>

      <div className="iram-adp__panels">
        {/* ─── Panel A: page-layout diagram with placement highlighted ─── */}
        <div className="iram-adp__panel">
          <div className="iram-adp__panel-label">على أي صفحة يظهر</div>

          <div className="iram-adp__page">
            <Slot active={fields.placement === 'header-banner'} name="header-banner">
              بانر علوي
            </Slot>

            <div className="iram-adp__row">
              <div className="iram-adp__hero">صورة المقال الرئيسي</div>
              <div className="iram-adp__sidebar">
                <Slot active={fields.placement === 'sidebar-top'} name="sidebar-top">
                  جانبي — أعلى
                </Slot>
                <div className="iram-adp__sidebar-content">روابط</div>
                <Slot
                  active={fields.placement === 'sidebar-bottom'}
                  name="sidebar-bottom"
                >
                  جانبي — أسفل
                </Slot>
              </div>
            </div>

            <Slot
              active={fields.placement === 'between-articles'}
              name="between-articles"
            >
              بين المقالات
            </Slot>

            <div className="iram-adp__cards">
              <span />
              <span />
              <span />
              <span />
            </div>

            <Slot active={fields.placement === 'article-inline'} name="article-inline">
              داخل النص (في الصفحات المنفردة)
            </Slot>

            <Slot active={fields.placement === 'article-end'} name="article-end">
              تحت كل مقال
            </Slot>

            <Slot active={fields.placement === 'footer'} name="footer">
              تذييل الصفحة
            </Slot>
          </div>
        </div>

        {/* ─── Panel B: rendered ad preview ─── */}
        <div className="iram-adp__panel">
          <div className="iram-adp__panel-label">شكله للقارئ ({placementLabel})</div>

          <div className={`iram-adp__ad iram-adp__ad--${fields.placement}`}>
            {image ? (
              <div className="iram-adp__ad-img">
                <img src={image.url} alt={image.alt || ''} />
                {fields.sponsoredLabel && (
                  <span className="iram-adp__ad-label">إعلان</span>
                )}
              </div>
            ) : (
              <div className="iram-adp__ad-placeholder">
                <span>📷</span>
                <small>ارفع صورة الإعلان لرؤية المعاينة</small>
              </div>
            )}

            {(fields.headline || fields.bodyText) && (
              <div className="iram-adp__ad-body">
                {fields.headline && (
                  <h5 className="iram-adp__ad-headline">{fields.headline}</h5>
                )}
                {fields.bodyText && (
                  <p className="iram-adp__ad-text">{fields.bodyText}</p>
                )}
                {fields.ctaText && (
                  <span className="iram-adp__ad-cta">{fields.ctaText} ←</span>
                )}
              </div>
            )}
          </div>

          {fields.advertiser && (
            <p className="iram-adp__attribution">
              المعلِن: <strong>{fields.advertiser}</strong>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

const Slot: React.FC<{
  active: boolean
  name: string
  children: React.ReactNode
}> = ({ active, children }) => (
  <div
    className={`iram-adp__slot ${active ? 'iram-adp__slot--active' : ''}`}
    aria-hidden
  >
    {active && <span className="iram-adp__slot-pulse" />}
    <span>{children}</span>
  </div>
)

export default AdPreview
