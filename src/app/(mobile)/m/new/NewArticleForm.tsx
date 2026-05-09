'use client'

import { useActionState, useState } from 'react'
import { createArticleAction, type Placement } from './actions'

interface Props {
  categories: Array<{ id: string; name: string }>
}

const PLACEMENTS: Array<{ value: Placement; emoji: string; label: string; hint: string }> = [
  { value: 'none', emoji: '📰', label: 'مقال عادي', hint: 'يظهر في قائمة آخر الأخبار فقط' },
  { value: 'main', emoji: '🏆', label: 'الرئيسي', hint: 'البطاقة الكبيرة في أعلى الصفحة' },
  { value: 'secondary-1', emoji: '🥈', label: 'ثانوي ١', hint: 'البطاقة الصغيرة الأولى' },
  { value: 'secondary-2', emoji: '🥈', label: 'ثانوي ٢', hint: 'البطاقة الصغيرة الثانية' },
  { value: 'secondary-3', emoji: '🥈', label: 'ثانوي ٣', hint: 'البطاقة الصغيرة الثالثة' },
]

const fmtBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function NewArticleForm({ categories }: Props) {
  const [state, action, pending] = useActionState(createArticleAction, {})
  const [status, setStatus] = useState<'draft' | 'published'>('published')
  const [placement, setPlacement] = useState<Placement>('none')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageInfo, setImageInfo] = useState<{ name: string; size: number } | null>(null)

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) {
      setImagePreview(null)
      setImageInfo(null)
      return
    }
    setImagePreview(URL.createObjectURL(f))
    setImageInfo({ name: f.name, size: f.size })
  }

  const fieldError = (k: keyof NonNullable<typeof state.fieldErrors>) => state.fieldErrors?.[k]

  return (
    <form action={action} className="m-form">
      {state?.error && (
        <div className="m-error" role="alert">
          <strong>⚠️ {state.error}</strong>
        </div>
      )}

      <Section heading="١. المحتوى">
        <Field label="العنوان" htmlFor="title" error={fieldError('title')}>
          <input
            id="title"
            name="title"
            type="text"
            required
            maxLength={120}
            className="m-input"
            placeholder="مثال: افتتاح مشروع جديد لدعم الشباب في رهط"
            aria-invalid={!!fieldError('title')}
          />
        </Field>

        <Field
          label="المقتطف"
          htmlFor="excerpt"
          error={fieldError('excerpt')}
          help="ملخص قصير يظهر تحت العنوان وفي نتائج جوجل (١٥٠–٢٥٠ حرف)."
        >
          <textarea
            id="excerpt"
            name="excerpt"
            required
            maxLength={300}
            rows={3}
            className="m-textarea"
            style={{ minHeight: 90 }}
            placeholder="ملخص في جملتين"
            aria-invalid={!!fieldError('excerpt')}
          />
        </Field>

        <Field
          label="نص المقال"
          htmlFor="body"
          error={fieldError('body')}
          help="اكتب النص هنا. اترك سطراً فارغاً بين الفقرات."
        >
          <textarea
            id="body"
            name="body"
            required
            rows={9}
            className="m-textarea"
            placeholder="ابدأ بالكتابة..."
            aria-invalid={!!fieldError('body')}
          />
        </Field>
      </Section>

      <Section heading="٢. التصنيف والصورة">
        <Field label="التصنيف" htmlFor="category" error={fieldError('category')}>
          <select
            id="category"
            name="category"
            required
            className="m-select"
            defaultValue=""
            aria-invalid={!!fieldError('category')}
          >
            <option value="" disabled>
              اختر تصنيفاً...
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="الصورة الرئيسية" htmlFor="image" error={fieldError('image')} help="اختياري · حتى ٣٠ ميغابايت · أي صيغة (JPEG / PNG / WebP / SVG …)">
          <label className="m-file" htmlFor="image">
            <span aria-hidden>🖼️</span>
            <span className="m-file__text">
              {imageInfo ? 'تغيير الصورة' : 'اختر صورة من معرض الصور أو الكاميرا'}
            </span>
            <input
              id="image"
              name="image"
              type="file"
              accept="image/*"
              onChange={onPick}
            />
          </label>
          {imagePreview && (
            <div className="m-file__preview">
              {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL preview, not a remote image */}
              <img src={imagePreview} alt="معاينة" />
              {imageInfo && (
                <div className="m-file__meta">
                  <span>{imageInfo.name}</span>
                  <span>{fmtBytes(imageInfo.size)}</span>
                </div>
              )}
            </div>
          )}
        </Field>
      </Section>

      <Section heading="٣. النشر والموضع">
        <Field label="الحالة عند الحفظ">
          <div className="m-toggle" role="radiogroup" aria-label="حالة المقال">
            <button
              type="button"
              role="radio"
              aria-checked={status === 'draft'}
              onClick={() => setStatus('draft')}
              className={`m-toggle__btn${status === 'draft' ? ' m-toggle__btn--active' : ''}`}
            >
              💾 مسودة
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={status === 'published'}
              onClick={() => setStatus('published')}
              className={`m-toggle__btn${status === 'published' ? ' m-toggle__btn--active' : ''}`}
            >
              🚀 نشر فوراً
            </button>
          </div>
          <input type="hidden" name="status" value={status} />
        </Field>

        <Field
          label="موضع المقال على الصفحة الرئيسية"
          help={
            status === 'draft'
              ? 'يتم تطبيق الموضع فقط على المقالات المنشورة. غيّر الحالة إلى "نشر فوراً" لاستخدامه.'
              : 'سيُعرض المقال في الموضع المختار من الصفحة الرئيسية.'
          }
        >
          <div className="m-placement" role="radiogroup" aria-label="موضع المقال">
            {PLACEMENTS.map((p) => {
              const checked = placement === p.value
              const disabled = status === 'draft' && p.value !== 'none'
              return (
                <button
                  key={p.value}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  disabled={disabled}
                  onClick={() => !disabled && setPlacement(p.value)}
                  className={`m-placement__btn${checked ? ' m-placement__btn--active' : ''}`}
                >
                  <span className="m-placement__emoji" aria-hidden>{p.emoji}</span>
                  <span className="m-placement__label">{p.label}</span>
                  <span className="m-placement__hint">{p.hint}</span>
                </button>
              )
            })}
          </div>
          <input type="hidden" name="placement" value={status === 'draft' ? 'none' : placement} />
        </Field>
      </Section>

      <button type="submit" disabled={pending} className="m-btn m-btn--gold m-btn--big">
        {pending ? (
          <>
            <span className="m-spinner" aria-hidden />
            جاري الحفظ...
          </>
        ) : status === 'draft' ? (
          '💾 حفظ كمسودة'
        ) : (
          '🚀 نشر المقال'
        )}
      </button>
    </form>
  )
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <fieldset className="m-section">
      <legend className="m-section__heading">{heading}</legend>
      <div className="m-section__body">{children}</div>
    </fieldset>
  )
}

function Field({
  label,
  htmlFor,
  help,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  help?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className={`m-field${error ? ' m-field--error' : ''}`}>
      <label className="m-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error && <span className="m-field__error">⚠️ {error}</span>}
      {!error && help && <span className="m-help">{help}</span>}
    </div>
  )
}
