'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export interface Town {
  name: string
  lat: number
  lon: number
  region: string
}

const DEFAULT_REGION_ORDER = [
  'الجليل',
  'المثلث',
  'النقب',
  'المدن المختلطة',
  'مرتفعات الكرمل',
]

const DEFAULT_TOWNS: Town[] = [
  // الجليل
  { name: 'الناصرة', lat: 32.7, lon: 35.3, region: 'الجليل' },
  { name: 'شفاعمرو', lat: 32.81, lon: 35.17, region: 'الجليل' },
  { name: 'سخنين', lat: 32.86, lon: 35.3, region: 'الجليل' },
  { name: 'طمرة', lat: 32.85, lon: 35.2, region: 'الجليل' },
  { name: 'عرابة', lat: 32.85, lon: 35.34, region: 'الجليل' },
  { name: 'المغار', lat: 32.89, lon: 35.41, region: 'الجليل' },
  { name: 'كفر كنا', lat: 32.74, lon: 35.34, region: 'الجليل' },
  { name: 'كفر مندا', lat: 32.81, lon: 35.26, region: 'الجليل' },
  { name: 'إكسال', lat: 32.68, lon: 35.32, region: 'الجليل' },
  { name: 'الرينة', lat: 32.74, lon: 35.31, region: 'الجليل' },
  { name: 'مجد الكروم', lat: 32.92, lon: 35.25, region: 'الجليل' },

  // المثلث
  { name: 'أم الفحم', lat: 32.52, lon: 35.15, region: 'المثلث' },
  { name: 'باقة الغربية', lat: 32.42, lon: 35.04, region: 'المثلث' },
  { name: 'الطيبة', lat: 32.27, lon: 35.0, region: 'المثلث' },
  { name: 'الطيرة', lat: 32.23, lon: 34.95, region: 'المثلث' },
  { name: 'قلنسوة', lat: 32.28, lon: 34.98, region: 'المثلث' },
  { name: 'كفر قاسم', lat: 32.11, lon: 34.98, region: 'المثلث' },
  { name: 'جلجولية', lat: 32.16, lon: 34.95, region: 'المثلث' },

  // النقب
  { name: 'رهط', lat: 31.39, lon: 34.75, region: 'النقب' },
  { name: 'حورة', lat: 31.31, lon: 34.93, region: 'النقب' },
  { name: 'تل السبع', lat: 31.26, lon: 34.85, region: 'النقب' },
  { name: 'كسيفة', lat: 31.24, lon: 34.97, region: 'النقب' },
  { name: 'لقية', lat: 31.32, lon: 34.86, region: 'النقب' },
  { name: 'عرعرة النقب', lat: 31.21, lon: 34.99, region: 'النقب' },
  { name: 'شقيب السلام', lat: 31.21, lon: 34.84, region: 'النقب' },

  // المدن المختلطة
  { name: 'حيفا', lat: 32.79, lon: 34.99, region: 'المدن المختلطة' },
  { name: 'عكا', lat: 32.93, lon: 35.08, region: 'المدن المختلطة' },
  { name: 'يافا', lat: 32.05, lon: 34.75, region: 'المدن المختلطة' },
  { name: 'اللد', lat: 31.95, lon: 34.89, region: 'المدن المختلطة' },
  { name: 'الرملة', lat: 31.93, lon: 34.87, region: 'المدن المختلطة' },

  // مرتفعات الكرمل
  { name: 'دالية الكرمل', lat: 32.69, lon: 35.05, region: 'مرتفعات الكرمل' },
  { name: 'عسفيا', lat: 32.74, lon: 35.07, region: 'مرتفعات الكرمل' },
  { name: 'بيت جن', lat: 32.96, lon: 35.38, region: 'مرتفعات الكرمل' },
  { name: 'يركا', lat: 32.97, lon: 35.21, region: 'مرتفعات الكرمل' },
]

const STORAGE_KEY = 'iram366:selected-town'
const DEFAULT_TOWN_NAME = 'رهط'
const HARDCODED_FALLBACK: Town = {
  name: 'رهط',
  lat: 31.39,
  lon: 34.75,
  region: 'النقب',
}

interface WeatherData {
  temp: number
  code: number
}

interface WeatherDateBarProps {
  towns?: Town[]
  siteName?: string
}

function weatherIcon(code: number): string {
  if (code === 0) return '☀️'
  if (code <= 3) return '⛅'
  if (code <= 48) return '🌫️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '❄️'
  if (code <= 82) return '🌦️'
  if (code <= 86) return '🌨️'
  if (code <= 99) return '⛈️'
  return '🌡️'
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function formatNow(d: Date) {
  return {
    date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

/**
 * Order of regions for the picker:
 * canonical regions first (in fixed order), then any new regions admins
 * have introduced via the CMS, in first-appearance order.
 */
function orderedRegions(towns: Town[]): string[] {
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const r of DEFAULT_REGION_ORDER) {
    if (towns.some((t) => t.region === r)) {
      ordered.push(r)
      seen.add(r)
    }
  }
  for (const t of towns) {
    if (!seen.has(t.region)) {
      ordered.push(t.region)
      seen.add(t.region)
    }
  }
  return ordered
}

export function WeatherDateBar({ towns: customTowns, siteName }: WeatherDateBarProps = {}) {
  const towns =
    customTowns && customTowns.length > 0 ? customTowns : DEFAULT_TOWNS
  const regions = useMemo(() => orderedRegions(towns), [towns])
  const fallbackTown: Town =
    towns.find((t) => t.name === DEFAULT_TOWN_NAME) ??
    towns[0] ??
    HARDCODED_FALLBACK

  const [now, setNow] = useState<Date | null>(null)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [townName, setTownName] = useState<string>(fallbackTown.name)
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved && towns.some((t) => t.name === saved)) {
        setTownName(saved)
      }
    } catch {
      /* localStorage may be disabled */
    }
  }, [towns])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, townName)
    } catch {
      /* ignore */
    }
  }, [townName])

  useEffect(() => {
    if (!pickerOpen) return
    function onClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPickerOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [pickerOpen])

  useEffect(() => {
    setNow(new Date())
    const tick = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(tick)
  }, [])

  const town: Town = towns.find((t) => t.name === townName) ?? fallbackTown

  useEffect(() => {
    let cancelled = false
    setWeather(null)
    async function load() {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${town.lat}&longitude=${town.lon}&current=temperature_2m,weather_code&timezone=auto`,
          { cache: 'no-store' },
        )
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setWeather({
          temp: Math.round(data.current.temperature_2m),
          code: data.current.weather_code,
        })
      } catch {
        /* silent */
      }
    }
    load()
    const refresh = setInterval(load, 10 * 60_000)
    return () => {
      cancelled = true
      clearInterval(refresh)
    }
  }, [town.lat, town.lon])

  const formatted = now ? formatNow(now) : null

  return (
    <div className="bg-navy-dark/70 text-white/85 text-base md:text-lg border-b border-white/10 relative z-50">
      <div className="container-news">
        <div className="flex items-center justify-between h-16 relative">
          {siteName && (
            <span
              className="iram-bar-brand absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden sm:flex items-center gap-2 font-display font-extrabold tracking-tight text-white text-base md:text-lg lg:text-xl whitespace-nowrap pointer-events-none"
              aria-hidden
            >
              <img
                src="/splash-logo.jpeg"
                alt=""
                className="iram-bar-brand__icon h-10 md:h-12 lg:h-14 w-auto flex-shrink-0"
              />
              <span>{siteName}</span>
            </span>
          )}
          <div className="flex items-center gap-3">
            <span suppressHydrationWarning>
              {weather ? (
                <>
                  <span aria-hidden>{weatherIcon(weather.code)}</span>{' '}
                  <span className="tabular-nums">{weather.temp}°C</span>
                </>
              ) : (
                <span className="opacity-40">...</span>
              )}
            </span>
            <div ref={pickerRef} className="relative">
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className="opacity-90 hover:opacity-100 hover:underline underline-offset-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/60 rounded px-1"
                aria-haspopup="listbox"
                aria-expanded={pickerOpen}
              >
                {town.name}{' '}
                <span aria-hidden className="opacity-60 text-sm">
                  ▾
                </span>
              </button>
              {pickerOpen && (
                <TownPicker
                  towns={towns}
                  regions={regions}
                  selectedName={townName}
                  onSelect={(name) => {
                    setTownName(name)
                    setPickerOpen(false)
                  }}
                />
              )}
            </div>
          </div>
          {formatted && (
            <time
              className="tabular-nums tracking-wide"
              suppressHydrationWarning
              dir="ltr"
            >
              {formatted.time} · {formatted.date}
            </time>
          )}
        </div>
      </div>
    </div>
  )
}

function TownPicker({
  towns,
  regions,
  selectedName,
  onSelect,
}: {
  towns: Town[]
  regions: string[]
  selectedName: string
  onSelect: (name: string) => void
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const q = query.trim()
  const filtered = q ? towns.filter((t) => t.name.includes(q)) : towns

  return (
    <div
      role="listbox"
      className="absolute top-full mt-1 start-0 w-64 max-h-[60vh] overflow-y-auto bg-navy text-white shadow-2xl border border-white/10 rounded-md text-sm"
    >
      <div className="sticky top-0 bg-navy border-b border-white/10 p-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث عن مدينة..."
          aria-label="ابحث عن مدينة"
          className="w-full bg-white/5 text-white placeholder:text-white/40 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-white/40 focus:bg-white/10"
        />
      </div>
      <div className="py-1">
        {filtered.length === 0 ? (
          <div className="px-3 py-3 text-center text-white/50 text-xs">
            لا توجد نتائج
          </div>
        ) : (
          regions.map((region) => {
            const inRegion = filtered.filter((t) => t.region === region)
            if (inRegion.length === 0) return null
            return (
              <div key={region}>
                <div className="px-3 pt-2 pb-1 text-[10px] tracking-wider text-white/50 font-semibold border-b border-white/5 mb-0.5">
                  {region}
                </div>
                {inRegion.map((t) => (
                  <button
                    key={t.name}
                    role="option"
                    aria-selected={t.name === selectedName}
                    onClick={() => onSelect(t.name)}
                    className={`block w-full text-start px-3 py-1.5 hover:bg-white/10 transition-colors ${
                      t.name === selectedName ? 'bg-white/10 font-semibold' : ''
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
