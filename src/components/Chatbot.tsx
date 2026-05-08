'use client'

import { useEffect, useRef, useState } from 'react'

interface ChatResult {
  title: string
  excerpt: string | null
  url: string
  publishedAt: string | null
  score: number
}

const ENABLED = process.env.NEXT_PUBLIC_CHATBOT_ENABLED === 'true'

/**
 * Floating chatbot widget.
 *
 * Returns null entirely when the feature flag is off — no UI, no fetches,
 * no impact on bundle eval beyond a single env-var read. When enabled,
 * hits /api/chat with the question and renders the matching articles
 * as clickable cards.
 */
export function Chatbot() {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [results, setResults] = useState<ChatResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  if (!ENABLED) return null

  const ask = async () => {
    const q = question.trim()
    if (!q || loading) return
    setLoading(true)
    setError(null)
    setResults(null)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      if (!res.ok) {
        setError('تعذّر الاتصال — حاول لاحقاً')
        return
      }
      const data = (await res.json()) as { results: ChatResult[] }
      setResults(data.results)
    } catch {
      setError('تعذّر الاتصال — حاول لاحقاً')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'إغلاق المساعد' : 'افتح المساعد'}
        className="fixed bottom-5 start-5 z-50 w-14 h-14 rounded-full bg-navy text-white shadow-lg hover:bg-navy-light transition-transform hover:scale-105 flex items-center justify-center"
      >
        <span aria-hidden className="text-2xl">{open ? '×' : '💬'}</span>
      </button>

      {open && (
        <div
          dir="rtl"
          className="fixed bottom-24 start-5 z-50 w-[min(92vw,380px)] bg-white text-ink rounded-xl shadow-2xl border border-ink/10 overflow-hidden flex flex-col"
        >
          <div className="bg-navy text-white px-4 py-3">
            <h3 className="font-display font-bold text-base">ابحث عن مقال</h3>
            <p className="text-xs opacity-70 mt-0.5">صف ما تتذكره من المقال — وسأجد أقرب نتيجة.</p>
          </div>

          <div className="p-3 border-b border-ink/10">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && ask()}
                disabled={loading}
                placeholder="مثال: المقال عن مهرجان رهط الأخير"
                className="flex-1 min-w-0 rounded border border-ink/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-gold disabled:opacity-50"
              />
              <button
                type="button"
                onClick={ask}
                disabled={loading || !question.trim()}
                className="px-3 py-2 rounded bg-accent-gold text-navy font-bold text-sm disabled:opacity-50 hover:bg-accent-gold-dark transition-colors"
              >
                {loading ? '...' : 'بحث'}
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {error && <p className="p-4 text-sm text-red-600">{error}</p>}

            {results && results.length === 0 && !loading && (
              <p className="p-4 text-sm text-ink/60 text-center">لم نجد مقالاً مطابقاً.</p>
            )}

            {results && results.length > 0 && (
              <ul className="divide-y divide-ink/10">
                {results.map((r) => (
                  <li key={r.url}>
                    <a
                      href={r.url}
                      className="block p-3 hover:bg-ink/5 transition-colors"
                      onClick={() => setOpen(false)}
                    >
                      <h4 className="font-display font-bold text-sm leading-snug line-clamp-2">{r.title}</h4>
                      {r.excerpt && (
                        <p className="text-xs text-ink/60 mt-1 line-clamp-2">{r.excerpt}</p>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            )}

            {!results && !error && !loading && (
              <p className="p-4 text-xs text-ink/50 text-center">
                مدعوم بالذكاء الاصطناعي — يفهم الوصف بلغة طبيعية.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
