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
  // Pending placement chosen *before* the article has an ID (i.e. on
  // the create-new flow). The mobile editor at /m/new bakes placement
  // into the same form submit that creates the article; the desktop
  // admin has the picker as a separate UI field with no access to the
  // create payload, so we capture the intent here and apply it the
  // instant useDocumentInfo() flips from no-id → real-id after the
  // first save. (Editors complained the desktop picker showed a
  // "save first" dead-end with no buttons — see the issue triage.)
  const [pendingPlacement, setPendingPlacement] = React.useState<Placement | null>(null)

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

  // Flush pending placement once the article has an ID. This is what
  // makes the desktop create-flow feel like the mobile flow — the user
  // chose "main" up front, saved the article, and now we send the
  // placement update without them having to click the button again.
  // `apply` reads `articleId` and `hero` directly, so we depend on
  // `pendingPlacement` and `articleId` to schedule the flush; the
  // function reference is intentionally not in the deps array — we
  // want exactly one flush per (articleId, pendingPlacement) pair.
  React.useEffect(() => {
    if (!articleId || !pendingPlacement) return
    // Don't fire while we're still loading the hero settings — apply()
    // composes a new hero object from the current snapshot, and acting
    // on a stale (null) snapshot would wipe other articles' placements.
    if (loading) return
    const target = pendingPlacement
    setPendingPlacement(null)
    // Fire-and-forget; apply() handles its own error display.
    void apply(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId, pendingPlacement, loading])

  // Current placement reflects what's actually saved on the server (for
  // existing articles) OR what the user has provisionally chosen (for a
  // brand-new article waiting for its first save). The `pendingPlacement
  // ?? …` fallback gives the buttons real visual feedback during the
  // pre-save window — without it, the picker would look broken because
  // clicks "did nothing."
  const current: Placement = articleId ? placementOf(articleId, hero) : (pendingPlacement ?? 'none')

  const apply = async (next: Placement) => {
    if (busy || next === current) return
    // No article ID yet → defer. Store the intent locally; the effect
    // below will fire it off as soon as the first save lands.
    if (!articleId) {
      setPendingPlacement(next)
      return
    }
    setBusy(true)
    setError(null)

    // POST to the narrow `/api/admin/hero-placement` endpoint instead of
    // PATCHing `/api/globals/site-settings` directly. The global is
    // locked to role=admin in SiteSettings.ts (and shouldn't be loosened
    // — admins control siteName, logo, etc.), so editors hitting the
    // PATCH would 403 with the misleading "تأكد من صلاحيات حسابك"
    // message. The narrow endpoint elevates the write to admin via
    // `overrideAccess: true` after verifying the caller is at least an
    // Editor — same write surface, correctly scoped permission.
    try {
      const res = await fetch('/api/admin/hero-placement', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, placement: next }),
      })
      if (!res.ok) {
        // Surface the server's Arabic message verbatim when present —
        // it already distinguishes "not signed in" / "wrong role" /
        // "article not found" so the editor knows what to do.
        let serverMessage: string | undefined
        try {
          const body = (await res.json()) as { error?: string }
          serverMessage = body?.error
        } catch {
          /* JSON parse failure — fall through to generic */
        }
        setError(serverMessage ?? 'فشل الحفظ — حاول لاحقاً')
        return
      }
      const data = (await res.json()) as { homepageHero?: HeroSettings }
      setHero(data?.homepageHero ?? null)
    } catch {
      setError('تعذّر الاتصال بالخادم — حاول لاحقاً')
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
      {!articleId && pendingPlacement && (
        <small className="iram-hero-pick__hint">
          سيُطبَّق هذا الموضع تلقائياً فور حفظ المقال للمرة الأولى.
        </small>
      )}
      {!articleId && !pendingPlacement && (
        <small className="iram-hero-pick__hint">
          اختر الموضع الآن — سيُطبَّق بعد حفظ المقال للمرة الأولى.
        </small>
      )}
      {articleId && (
        <small className="iram-hero-pick__hint">
          التغيير يضبط وضع الصفحة الرئيسية على &quot;يدوي&quot; تلقائياً.
        </small>
      )}
    </div>
  )
}

export default HeroPlacementPicker
