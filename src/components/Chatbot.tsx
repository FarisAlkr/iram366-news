'use client'

import { useEffect, useRef, useState } from 'react'

interface ArticleHit {
  title: string
  excerpt: string | null
  url: string
  publishedAt: string | null
  score: number
}

type Message =
  | { kind: 'user'; text: string }
  | { kind: 'bot-text'; text: string }
  | { kind: 'bot-articles'; articles: ArticleHit[] }
  | { kind: 'bot-empty' }

// Demo conversation shown on first open — gives the bot a personality and
// shows visitors what they can ask. The "developer" question doubles as a
// little easter-egg credit on the public site.
const DEMO_MESSAGES: Message[] = [
  { kind: 'user', text: 'من مطوّر ومبرمج هذه المنصّة الإخبارية؟' },
  { kind: 'bot-text', text: 'مهندس البرمجيّات فارس القريناوي 🌟' },
]

// Hard-coded patterns that work without the AI. If a visitor types
// something matching one of these, we answer locally — no API call.
const EASTER_EGGS: Array<{ pattern: RegExp; reply: string }> = [
  {
    pattern:
      /\b(من\s*طو[رّ]|من\s*بن[ىي]|من\s*صم[مّ]|من\s*برم[جّ]|المطو[رّ]|المبرم[جّ]|مهندس|developed|built|made|created|programmed|engineer)\b/i,
    reply: 'مهندس البرمجيّات فارس القريناوي 🌟',
  },
  {
    pattern: /\b(تواصل|اتصال|اتواصل|contact|email)\b/i,
    reply: 'تستطيع التواصل معنا عبر الرقم الموجود في تذييل الموقع، أو من قائمة "تابعنا".',
  },
  {
    pattern: /\b(عاجل|breaking|أخر الأخبار|اخر الاخبار)\b/i,
    reply: 'الأخبار العاجلة تظهر في الشريط الأحمر أعلى الموقع 🚨',
  },
]

function findEasterEgg(text: string): string | null {
  for (const eg of EASTER_EGGS) {
    if (eg.pattern.test(text)) return eg.reply
  }
  return null
}

export function Chatbot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>(DEMO_MESSAGES)
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    // Auto-scroll to bottom when a new message arrives
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  const ask = async () => {
    const q = question.trim()
    if (!q || loading) return
    setQuestion('')
    setMessages((prev) => [...prev, { kind: 'user', text: q }])

    // 1) Check local easter-eggs first — instant, no API call
    const local = findEasterEgg(q)
    if (local) {
      setMessages((prev) => [...prev, { kind: 'bot-text', text: local }])
      return
    }

    // 2) Article search via /api/chat. The endpoint itself is the source
    //    of truth — it 404s if the server-side feature flag is off, in
    //    which case we show a polite "coming soon" stub.
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      if (res.status === 404) {
        setMessages((prev) => [
          ...prev,
          {
            kind: 'bot-text',
            text: 'البحث الذكي عن المقالات سيتوفّر قريباً 🤖. حالياً تستطيع تصفّح الأقسام من القائمة أعلاه.',
          },
        ])
        return
      }
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { kind: 'bot-text', text: 'تعذّر الاتصال — حاول لاحقاً.' },
        ])
        return
      }
      const data = (await res.json()) as { results: ArticleHit[] }
      if (!data.results || data.results.length === 0) {
        setMessages((prev) => [...prev, { kind: 'bot-empty' }])
      } else {
        setMessages((prev) => [...prev, { kind: 'bot-articles', articles: data.results }])
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { kind: 'bot-text', text: 'تعذّر الاتصال — حاول لاحقاً.' },
      ])
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
        className="iram-chatbot-toggle fixed bottom-5 start-5 z-[60] w-14 h-14 rounded-full bg-navy shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
      >
        {open ? (
          <span aria-hidden className="text-2xl text-white">×</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- needs CSS mask
          <img
            src="/splash-logo.jpeg"
            alt=""
            aria-hidden
            className="iram-chatbot-toggle__logo"
          />
        )}
      </button>

      {open && (
        <div
          dir="rtl"
          className="fixed bottom-24 start-5 z-[60] w-[min(92vw,380px)] bg-white text-ink rounded-xl shadow-2xl border border-ink/10 overflow-hidden flex flex-col max-h-[70vh]"
        >
          <div className="bg-navy text-white px-4 py-3 flex-shrink-0">
            <h3 className="font-display font-bold text-base">مساعد إرم 366</h3>
            <p className="text-xs opacity-70 mt-0.5">
              اسأل عن مقال، عن الموقع، أو جرّب أحد الأسئلة الجاهزة.
            </p>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((m, i) => {
              if (m.kind === 'user') {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[80%] bg-navy text-white rounded-2xl rounded-br-md px-3.5 py-2 text-sm leading-relaxed">
                      {m.text}
                    </div>
                  </div>
                )
              }
              if (m.kind === 'bot-text') {
                return (
                  <div key={i} className="flex justify-start">
                    <div className="max-w-[85%] bg-cream-dark text-ink rounded-2xl rounded-bl-md px-3.5 py-2 text-sm leading-relaxed">
                      {m.text}
                    </div>
                  </div>
                )
              }
              if (m.kind === 'bot-empty') {
                return (
                  <div key={i} className="flex justify-start">
                    <div className="max-w-[85%] bg-cream-dark text-ink/70 rounded-2xl rounded-bl-md px-3.5 py-2 text-sm">
                      لم نجد مقالاً مطابقاً. جرّب وصفاً آخر.
                    </div>
                  </div>
                )
              }
              // bot-articles
              return (
                <div key={i} className="space-y-1.5">
                  <div className="text-xs text-ink/60 px-1">
                    وجدنا {m.articles.length} مقال{m.articles.length === 1 ? '' : ' مطابق'}:
                  </div>
                  {m.articles.map((r) => (
                    <a
                      key={r.url}
                      href={r.url}
                      onClick={() => setOpen(false)}
                      className="block bg-cream-dark hover:bg-cream rounded-xl p-2.5 border border-ink/5 transition-colors"
                    >
                      <h4 className="font-display font-bold text-[13.5px] leading-snug line-clamp-2">
                        {r.title}
                      </h4>
                      {r.excerpt && (
                        <p className="text-xs text-ink/60 mt-1 line-clamp-2">{r.excerpt}</p>
                      )}
                    </a>
                  ))}
                </div>
              )
            })}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-cream-dark text-ink/60 rounded-2xl rounded-bl-md px-3.5 py-2 text-sm flex items-center gap-1.5">
                  <span className="iram-chat-dot" />
                  <span className="iram-chat-dot" style={{ animationDelay: '0.15s' }} />
                  <span className="iram-chat-dot" style={{ animationDelay: '0.3s' }} />
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-ink/10 flex-shrink-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && ask()}
                disabled={loading}
                placeholder="مثال: من طوّر هذا الموقع؟"
                className="flex-1 min-w-0 rounded-full border border-ink/20 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-gold disabled:opacity-50"
              />
              <button
                type="button"
                onClick={ask}
                disabled={loading || !question.trim()}
                aria-label="إرسال"
                className="w-10 h-10 flex-shrink-0 rounded-full bg-accent-gold text-navy font-bold disabled:opacity-50 hover:bg-accent-gold-dark transition-colors flex items-center justify-center"
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
