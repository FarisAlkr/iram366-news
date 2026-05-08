/**
 * Slug + Arabic text utilities.
 *
 * Public-site slugs auto-generate from the title via Latin transliteration
 * (instead of keeping Arabic characters) — this gives URLs that work cleanly
 * across browsers, messaging apps, and copy-paste, and look professional in
 * the address bar. Editors can override with any value they prefer.
 *
 * `normalizeArabic` is used elsewhere (search, validation) to collapse
 * diacritics and unify letter variants.
 */

const MAX_SLUG_LEN = 80

const ARABIC_DIACRITICS = /[ً-ْٰـ]/g // tashkīl + tatweel
const NORMALIZATIONS: Array<[RegExp, string]> = [
  [/[إأآا]/g, 'ا'],
  [/ى/g, 'ي'],
  [/ة/g, 'ه'],
]

// Arabic → Latin character map. Multi-letter combos must come first so
// `ش` doesn't get caught by the single-letter `س` mapping. Coverage:
//   * 28 base Arabic letters
//   * letter variants (ة → h, ى → a, ء omitted)
//   * Hindu-Arabic and Eastern Arabic numerals → ASCII digits
const TRANSLIT_MAP: Array<[RegExp, string]> = [
  // Multi-letter combos (longer matches first)
  [/ث/g, 'th'],
  [/خ/g, 'kh'],
  [/ذ/g, 'dh'],
  [/ش/g, 'sh'],
  [/غ/g, 'gh'],
  // Single-letter consonants
  [/ا/g, 'a'],
  [/ب/g, 'b'],
  [/ت/g, 't'],
  [/ج/g, 'j'],
  [/ح/g, 'h'],
  [/د/g, 'd'],
  [/ر/g, 'r'],
  [/ز/g, 'z'],
  [/س/g, 's'],
  [/ص/g, 's'],
  [/ض/g, 'd'],
  [/ط/g, 't'],
  [/ظ/g, 'z'],
  [/ع/g, 'a'],
  [/ف/g, 'f'],
  [/ق/g, 'q'],
  [/ك/g, 'k'],
  [/ل/g, 'l'],
  [/م/g, 'm'],
  [/ن/g, 'n'],
  [/ه/g, 'h'],
  [/و/g, 'w'],
  [/ي/g, 'y'],
  // Letter variants
  [/ة/g, 'h'],
  [/ى/g, 'a'],
  [/ء|ؤ|ئ/g, ''],
  // Eastern Arabic numerals (٠–٩)
  [/٠/g, '0'], [/١/g, '1'], [/٢/g, '2'], [/٣/g, '3'], [/٤/g, '4'],
  [/٥/g, '5'], [/٦/g, '6'], [/٧/g, '7'], [/٨/g, '8'], [/٩/g, '9'],
  // Persian numerals just in case (۰–۹)
  [/۰/g, '0'], [/۱/g, '1'], [/۲/g, '2'], [/۳/g, '3'], [/۴/g, '4'],
  [/۵/g, '5'], [/۶/g, '6'], [/۷/g, '7'], [/۸/g, '8'], [/۹/g, '9'],
]

/**
 * Transliterate Arabic text to Latin characters for URL slugs.
 * Strips diacritics, applies the character map, lowercases, removes
 * non-slug characters. Output is safe for use as a URL path component.
 *
 *   transliterate('بلدية رهط')                  → 'bldyh rht'
 *   transliterate('افتتاح مشروع جديد في رهط')   → 'afttah mshrwa jdyd fy rht'
 *   transliterate('Hello World 2026')            → 'hello world 2026'
 */
export function transliterate(input: string): string {
  if (!input) return ''
  let s = input.replace(ARABIC_DIACRITICS, '')
  for (const [from, to] of TRANSLIT_MAP) s = s.replace(from, to)
  return s.toLowerCase()
}

/**
 * Build a URL slug from any title (Arabic, Latin, mixed). Always Latin
 * output. Use this for auto-generated slugs on Articles, Series, etc.
 */
export function slugify(input: string): string {
  if (!input) return ''
  const transliterated = transliterate(input)
  const cleaned = transliterated
    .trim()
    .replace(/[^a-z0-9\s-]/g, ' ')   // strip anything not Latin / digit / space / dash
    .replace(/\s+/g, '-')            // collapse whitespace to hyphens
    .replace(/-+/g, '-')             // collapse multiple hyphens
    .replace(/^-|-$/g, '')           // trim leading/trailing hyphens
  // Truncate AFTER trimming hyphens, then re-trim the cut edge so we never
  // emit "foo-bar-" with a dangling separator that breaks routing.
  return cleaned.substring(0, MAX_SLUG_LEN).replace(/-+$/, '')
}

export function ensureSlug(title: string, fallbackPrefix = 'article'): string {
  return slugify(title) || `${fallbackPrefix}-${Date.now()}`
}

/**
 * Whether a string is a plausible URL slug. Now Latin-only since slugs
 * are transliterated. Editors can still type Arabic slugs manually if they
 * want — those will fail validation and they'll be told to use Latin.
 */
export function isValidSlug(s: string): boolean {
  if (!s || s.length > MAX_SLUG_LEN) return false
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)
}

export function normalizeArabic(input: string): string {
  if (!input) return ''
  let s = input.replace(ARABIC_DIACRITICS, '')
  for (const [from, to] of NORMALIZATIONS) s = s.replace(from, to)
  return s.toLowerCase()
}
