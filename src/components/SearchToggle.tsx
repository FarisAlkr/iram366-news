'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function SearchToggle() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<{ title: string; slug: string }[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const debounceRef = useRef<NodeJS.Timeout>(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=5`)
        const data = await res.json()
        setSuggestions(data.results || [])
      } catch {
        setSuggestions([])
      }
    }, 300)
  }, [query])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`)
      setIsOpen(false)
      setQuery('')
      setSuggestions([])
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded p-2 transition-colors duration-150 hover:bg-white/10"
        aria-label="بحث"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-navy/80 pt-[15vh] backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsOpen(false)
              setQuery('')
              setSuggestions([])
            }
          }}
        >
          <div className="mx-4 w-full max-w-2xl">
            <form onSubmit={handleSubmit}>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث في الأخبار..."
                className="w-full rounded-lg bg-surface px-6 py-4 font-body text-xl text-ink shadow-2xl outline-none placeholder:text-[var(--color-ink-muted)] md:text-2xl"
                dir="rtl"
              />
            </form>
            {suggestions.length > 0 && (
              <div className="mt-2 overflow-hidden rounded-lg bg-surface shadow-2xl">
                {suggestions.map((s) => (
                  <a
                    key={s.slug}
                    href={`/articles/${s.slug}`}
                    className="block border-b border-[var(--color-border)] px-6 py-3 text-base font-medium text-ink transition-colors duration-150 last:border-0 hover:bg-cream-dark"
                    onClick={() => {
                      setIsOpen(false)
                      setQuery('')
                      setSuggestions([])
                    }}
                  >
                    {s.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
