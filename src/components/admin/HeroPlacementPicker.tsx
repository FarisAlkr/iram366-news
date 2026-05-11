'use client'

import React from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

type Placement = 'main' | 'secondary-1' | 'secondary-2' | 'secondary-3' | 'none'

interface HeroSettings {
  mode?: 'auto' | 'manual'
  mainArticle?: { id: string | number } | string | number | null
  secondaryArticles?: Array<{ id: string | number } | string | number> | null
}

const refId = (ref: HeroSettings['mainArticle']): string | number | null => {
  if (ref == null) return null
  if (typeof ref === 'object') return ref.id
  return ref
}

function placementOf(id: string | number, hero: HeroSettings | null): Placement {
  if (!hero) return 'none'
  if (refId(hero.mainArticle) === id) return 'main'
  const secs = (hero.secondaryArticles || []).map(refId)
  const idx = secs.indexOf(id)
  if (idx === 0) return 'secondary-1'
  if (idx === 1) return 'secondary-2'
  if (idx === 2) return 'secondary-3'
  return 'none'
}

const LABELS: Record<Placement, string> = {
  main: '🏆 المقال الرئيسي',
  'secondary-1': '🥈 ثانوي #1',
  'secondary-2': '🥈 ثانوي #2',
  'secondary-3': '🥈 ثانوي #3',
  none: '✕ بدون موضع',
}

export const HeroPlacementPicker: React.FC = () => {
  const { id } = useDocumentInfo()
  const articleId = typeof id === 'string' || typeof id === 'number' ? id : null

  const [hero, setHero] = React.useState<HeroSettings | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/globals/site-settings?depth=0', {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('failed to load')
      const data = await res.json()
      setHero(data?.homepageHero ?? {})
    } catch {
      setError('تعذّر تحميل إعدادات الصفحة الرئيسية')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  if (!articleId) {
    return (
      <div className="iram-hero-pick iram-hero-pick--idle">
        <strong>📍 موضع المقال على الصفحة الرئيسية</strong>
        <small>احفظ المقال أولاً ثم اختر موضعه.</small>
      </div>
    )
  }

  const current = placementOf(articleId, hero)

  const apply = async (next: Placement) => {
    if (busy || next === current) return
    setBusy(true)
    setError(null)

    const safeHero: HeroSettings = hero ?? {}
    const newHero: HeroSettings = {
      mode: 'manual',
      mainArticle: refId(safeHero.mainArticle),
      secondaryArticles: (safeHero.secondaryArticles || [])
        .map(refId)
        .filter((x): x is string | number => x != null),
    }

    if (next === 'main') {
      // Promote to main; if it was a secondary, drop it from there.
      newHero.mainArticle = articleId
      newHero.secondaryArticles = (newHero.secondaryArticles || []).filter((x) => x !== articleId)
    } else if (next.startsWith('secondary-')) {
      const slot = Number(next.split('-')[1]) - 1
      const arr = (newHero.secondaryArticles || []).slice()
      // If this article already in another secondary slot, remove it first.
      const existingIdx = arr.indexOf(articleId)
      if (existingIdx >= 0 && existingIdx !== slot) arr.splice(existingIdx, 1)
      // Pad up to slot index with null then assign
      while (arr.length <= slot) arr.push(null as unknown as string | number)
      arr[slot] = articleId
      newHero.secondaryArticles = arr.filter((x): x is string | number => x != null)
      // If it was the main, demote
      if (newHero.mainArticle === articleId) newHero.mainArticle = null
    } else {
      // 'none' — remove from any slot
      if (newHero.mainArticle === articleId) newHero.mainArticle = null
      newHero.secondaryArticles = (newHero.secondaryArticles || []).filter((x) => x !== articleId)
    }

    try {
      const res = await fetch('/api/globals/site-settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homepageHero: newHero }),
      })
      if (!res.ok) throw new Error('save failed')
      const data = await res.json()
      setHero(data?.result?.homepageHero ?? data?.homepageHero ?? newHero)
    } catch {
      setError('فشل الحفظ — تأكد من صلاحيات حسابك')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="iram-hero-pick" dir="rtl">
      <strong>📍 موضع المقال على الصفحة الرئيسية</strong>

      <div className="iram-hero-pick__current" data-placement={current}>
        الحالي: <span>{LABELS[current]}</span>
      </div>

      {loading ? (
        <small>...جاري التحميل</small>
      ) : (
        <div className="iram-hero-pick__buttons">
          {(['main', 'secondary-1', 'secondary-2', 'secondary-3', 'none'] as Placement[]).map(
            (p) => (
              <button
                key={p}
                type="button"
                onClick={() => apply(p)}
                disabled={busy || p === current}
                data-active={p === current || undefined}
                className={`iram-hero-pick__btn ${p === current ? 'iram-hero-pick__btn--active' : ''}`}
              >
                {LABELS[p]}
              </button>
            ),
          )}
        </div>
      )}

      {error && <small className="iram-hero-pick__error">{error}</small>}
      <small className="iram-hero-pick__hint">
        التغيير يضبط وضع الصفحة الرئيسية على &quot;يدوي&quot; تلقائياً.
      </small>
    </div>
  )
}

export default HeroPlacementPicker
