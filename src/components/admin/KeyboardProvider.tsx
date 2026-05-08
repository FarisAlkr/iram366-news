'use client'

import React from 'react'

/**
 * Global keyboard provider — wraps the admin shell and handles:
 *
 *  - ⌘/Ctrl + K        → open command palette (jump to any article/category/user/location)
 *  - ?                  → open shortcuts overlay
 *  - Esc                → close any open overlay
 *
 * Mounted via `admin.components.providers` so it's present on every admin page.
 */
export const KeyboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [paletteOpen, setPaletteOpen] = React.useState(false)
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const inEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)

      // ⌘/Ctrl + K — palette
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setPaletteOpen((open) => !open)
        setShortcutsOpen(false)
        return
      }

      // ? — shortcuts (only when not typing)
      if (!inEditable && e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setShortcutsOpen((open) => !open)
        setPaletteOpen(false)
        return
      }

      // Esc — close any
      if (e.key === 'Escape') {
        setPaletteOpen(false)
        setShortcutsOpen(false)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      {children}
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {shortcutsOpen && <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />}
    </>
  )
}

// ---------------------------------------------------------------------------
// Command palette — fuzzy search across collections
// ---------------------------------------------------------------------------

interface PaletteResult {
  id: string | number
  collection: string
  title: string
  subtitle?: string
  href: string
  icon: string
}

const COLLECTIONS_TO_SEARCH: Array<{
  slug: string
  label: string
  icon: string
  titleField: string
  subtitleField?: string
  searchFields: string[]
}> = [
  {
    slug: 'articles',
    label: 'مقال',
    icon: '📰',
    titleField: 'title',
    subtitleField: 'excerpt',
    searchFields: ['title', 'excerpt', 'slug'],
  },
  {
    slug: 'categories',
    label: 'تصنيف',
    icon: '🏷️',
    titleField: 'name',
    subtitleField: 'slug',
    searchFields: ['name', 'slug'],
  },
  {
    slug: 'users',
    label: 'مستخدم',
    icon: '👤',
    titleField: 'name',
    subtitleField: 'email',
    searchFields: ['name', 'email'],
  },
  {
    slug: 'locations',
    label: 'موقع',
    icon: '📍',
    titleField: 'name',
    subtitleField: 'nameEn',
    searchFields: ['name', 'nameEn'],
  },
  {
    slug: 'series',
    label: 'سلسلة',
    icon: '📚',
    titleField: 'name',
    subtitleField: 'description',
    searchFields: ['name'],
  },
  {
    slug: 'media',
    label: 'وسائط',
    icon: '🖼️',
    titleField: 'filename',
    subtitleField: 'alt',
    searchFields: ['filename', 'alt', 'caption'],
  },
]

const CommandPalette: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<PaletteResult[]>([])
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  React.useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const ctrl = new AbortController()
    setLoading(true)

    const search = async () => {
      const all = await Promise.all(
        COLLECTIONS_TO_SEARCH.map(async (c) => {
          try {
            // Build a where-OR across all the searchable text fields.
            const orClauses = c.searchFields.map(
              (field) => `where[or][][${field}][contains]=${encodeURIComponent(query)}`,
            )
            const url = `/api/${c.slug}?limit=4&depth=0&${orClauses.join('&')}`
            const res = await fetch(url, { signal: ctrl.signal })
            if (!res.ok) return []
            const json = (await res.json()) as { docs: Array<Record<string, unknown>> }
            return (json.docs || []).map<PaletteResult>((d) => ({
              id: d.id as string | number,
              collection: c.label,
              title: String(d[c.titleField] || '(بلا عنوان)'),
              subtitle: c.subtitleField ? String(d[c.subtitleField] || '') : undefined,
              href: `/admin/collections/${c.slug}/${d.id}`,
              icon: c.icon,
            }))
          } catch {
            return []
          }
        }),
      )
      setResults(all.flat())
      setActiveIndex(0)
      setLoading(false)
    }

    const t = setTimeout(search, 150) // debounce
    return () => {
      ctrl.abort()
      clearTimeout(t)
    }
  }, [query])

  const onResultKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault()
      window.location.href = results[activeIndex].href
    }
  }

  return (
    <div className="iram-cmdk__overlay" onClick={onClose} role="presentation">
      <div
        className="iram-cmdk__panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="بحث سريع"
      >
        <div className="iram-cmdk__searchbar">
          <span className="iram-cmdk__icon" aria-hidden>
            🔎
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onResultKey}
            placeholder="ابحث في المقالات، التصنيفات، المستخدمين، المواقع..."
            className="iram-cmdk__input"
            dir="rtl"
          />
          <kbd className="iram-cmdk__kbd">Esc</kbd>
        </div>

        <div className="iram-cmdk__results" dir="rtl">
          {loading && <div className="iram-cmdk__hint">يبحث...</div>}
          {!loading && query && results.length === 0 && (
            <div className="iram-cmdk__hint">لا توجد نتائج لـ &ldquo;{query}&rdquo;</div>
          )}
          {!query && (
            <div className="iram-cmdk__hint">
              اكتب أي كلمة من العنوان أو الرابط للقفز إليها مباشرة
              <div className="iram-cmdk__tips">
                <span>↑↓ للتنقل</span>
                <span>↵ للفتح</span>
                <span>Esc للإغلاق</span>
              </div>
            </div>
          )}
          {results.map((r, i) => (
            <a
              key={`${r.collection}-${r.id}`}
              href={r.href}
              className={`iram-cmdk__row ${i === activeIndex ? 'iram-cmdk__row--active' : ''}`}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span className="iram-cmdk__row-icon" aria-hidden>
                {r.icon}
              </span>
              <span className="iram-cmdk__row-body">
                <span className="iram-cmdk__row-title">{r.title}</span>
                {r.subtitle && (
                  <span className="iram-cmdk__row-subtitle">{r.subtitle}</span>
                )}
              </span>
              <span className="iram-cmdk__row-tag">{r.collection}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts overlay
// ---------------------------------------------------------------------------

const SHORTCUTS: Array<{ keys: string[]; description: string; group: string }> = [
  { group: 'تنقل', keys: ['⌘', 'K'], description: 'بحث سريع — قفز لأي مقال أو صفحة' },
  { group: 'تنقل', keys: ['?'], description: 'إظهار قائمة الاختصارات (هذه)' },
  { group: 'تنقل', keys: ['Esc'], description: 'إغلاق أي نافذة منبثقة' },
  { group: 'تحرير', keys: ['⌘', 'S'], description: 'حفظ المقال (يحفظ نسخة في السجل)' },
  { group: 'تحرير', keys: ['⌘', 'B'], description: 'نص عريض' },
  { group: 'تحرير', keys: ['⌘', 'I'], description: 'نص مائل' },
  { group: 'تحرير', keys: ['⌘', 'Z'], description: 'تراجع' },
  { group: 'تحرير', keys: ['⌘', '⇧', 'Z'], description: 'إعادة' },
]

const ShortcutsOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const grouped = React.useMemo(() => {
    const out = new Map<string, typeof SHORTCUTS>()
    for (const s of SHORTCUTS) {
      const list = out.get(s.group) ?? []
      list.push(s)
      out.set(s.group, list)
    }
    return Array.from(out.entries())
  }, [])

  return (
    <div className="iram-shortcuts__overlay" onClick={onClose} role="presentation">
      <div
        className="iram-shortcuts__panel"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
        role="dialog"
        aria-modal="true"
      >
        <div className="iram-shortcuts__head">
          <h3 className="iram-shortcuts__title">⌨️ اختصارات لوحة المفاتيح</h3>
          <button className="iram-shortcuts__close" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>

        {grouped.map(([group, items]) => (
          <div className="iram-shortcuts__group" key={group}>
            <h4 className="iram-shortcuts__group-label">{group}</h4>
            <ul className="iram-shortcuts__list">
              {items.map((s, i) => (
                <li className="iram-shortcuts__row" key={i}>
                  <span className="iram-shortcuts__desc">{s.description}</span>
                  <span className="iram-shortcuts__keys">
                    {s.keys.map((k, j) => (
                      <kbd key={j} className="iram-shortcuts__kbd">
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <p className="iram-shortcuts__foot">
          استخدم <kbd className="iram-shortcuts__kbd">⌘ K</kbd> لفتح البحث السريع
          من أي مكان.
        </p>
      </div>
    </div>
  )
}

export default KeyboardProvider
