'use client'

import { useActionState, useState } from 'react'
import { createArticleAction } from './actions'

interface Props {
  categories: Array<{ id: string; name: string }>
}

export function NewArticleForm({ categories }: Props) {
  const [state, action, pending] = useActionState(createArticleAction, {})
  const [status, setStatus] = useState<'draft' | 'published'>('published')
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) {
      setImagePreview(null)
      return
    }
    const url = URL.createObjectURL(f)
    setImagePreview(url)
  }

  return (
    <form action={action} className="m-form">
      {state?.error && <div className="m-error">{state.error}</div>}

      <div className="m-field">
        <label className="m-label" htmlFor="title">العنوان</label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={120}
          className="m-input"
          placeholder="مثال: افتتاح مشروع جديد لدعم الشباب في رهط"
        />
      </div>

      <div className="m-field">
        <label className="m-label" htmlFor="excerpt">المقتطف</label>
        <textarea
          id="excerpt"
          name="excerpt"
          required
          maxLength={300}
          rows={3}
          className="m-textarea"
          style={{ minHeight: 90 }}
          placeholder="ملخص قصير للمقال (150–250 حرف)"
        />
        <span className="m-help">يظهر تحت العنوان في البطاقات وفي نتائج جوجل.</span>
      </div>

      <div className="m-field">
        <label className="m-label" htmlFor="category">التصنيف</label>
        <select id="category" name="category" required className="m-select" defaultValue="">
          <option value="" disabled>اختر تصنيفاً...</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="m-field">
        <label className="m-label" htmlFor="image">الصورة الرئيسية (اختياري)</label>
        <label className="m-file" htmlFor="image">
          <span aria-hidden>📷</span>
          <span>{imagePreview ? 'تغيير الصورة' : 'اختر صورة من الكاميرا أو الاستوديو'}</span>
          <input
            id="image"
            name="image"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPick}
          />
        </label>
        {imagePreview && (
          <img
            src={imagePreview}
            alt=""
            style={{ marginTop: 8, borderRadius: 8, maxWidth: '100%', maxHeight: 200, objectFit: 'cover' }}
          />
        )}
      </div>

      <div className="m-field">
        <label className="m-label" htmlFor="body">نص المقال</label>
        <textarea
          id="body"
          name="body"
          required
          rows={8}
          className="m-textarea"
          placeholder="اكتب نص المقال هنا. اترك سطراً فارغاً بين الفقرات."
        />
        <span className="m-help">للتنسيق المتقدم (صور داخل النص، اقتباسات، روابط) استخدم نسخة الكمبيوتر.</span>
      </div>

      <div className="m-field">
        <label className="m-label">الحالة عند الحفظ</label>
        <div className="m-toggle" role="radiogroup">
          <button
            type="button"
            role="radio"
            aria-checked={status === 'draft'}
            onClick={() => setStatus('draft')}
            className={`m-toggle__btn${status === 'draft' ? ' m-toggle__btn--active' : ''}`}
          >
            مسودة
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={status === 'published'}
            onClick={() => setStatus('published')}
            className={`m-toggle__btn${status === 'published' ? ' m-toggle__btn--active' : ''}`}
          >
            نشر فوراً
          </button>
        </div>
        <input type="hidden" name="status" value={status} />
      </div>

      <button type="submit" disabled={pending} className="m-btn m-btn--gold">
        {pending ? '...جاري الحفظ' : status === 'draft' ? 'حفظ كمسودة' : 'نشر المقال'}
      </button>
    </form>
  )
}
