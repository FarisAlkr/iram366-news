// One-shot maintenance: convert any article whose slug contains non-Latin
// characters to a Latin slug derived from its title via the project's
// `slugify` helper. Idempotent — articles already on a Latin slug are skipped.
//
// Run: NODE_ENV=development node --import=tsx scripts/reslugify-articles.mjs
//
// Why: the public article page (Next.js 15 App Router under `output:
// standalone`) does not reliably match URL paths containing percent-encoded
// Arabic characters. The local Payload API resolves them fine; the page
// route's `params.slug` does not. Switching every article to Latin slugs
// sidesteps the bug AND aligns with the editorial preference for Latin
// URLs that copy/paste cleanly into messaging apps.

// Direct Postgres update — bypasses Payload entirely to avoid the
// `payload/dist/bin/loadEnv.js` import quirk when run from this dev container.
import pg from 'pg'

// Inlined transliterate + slugify (avoid tsx ESM-export quirks for .ts imports
// when this script runs from a one-shot dev container)
const MAX_SLUG_LEN = 80
const ARABIC_DIACRITICS = /[ً-ْٰـ]/g
const TRANSLIT_MAP = [
  [/ث/g, 'th'], [/خ/g, 'kh'], [/ذ/g, 'dh'], [/ش/g, 'sh'], [/غ/g, 'gh'],
  [/ا/g, 'a'], [/ب/g, 'b'], [/ت/g, 't'], [/ج/g, 'j'], [/ح/g, 'h'],
  [/د/g, 'd'], [/ر/g, 'r'], [/ز/g, 'z'], [/س/g, 's'], [/ص/g, 's'],
  [/ض/g, 'd'], [/ط/g, 't'], [/ظ/g, 'z'], [/ع/g, 'a'], [/ف/g, 'f'],
  [/ق/g, 'q'], [/ك/g, 'k'], [/ل/g, 'l'], [/م/g, 'm'], [/ن/g, 'n'],
  [/ه/g, 'h'], [/و/g, 'w'], [/ي/g, 'y'],
  [/ة/g, 'h'], [/ى/g, 'a'], [/ء|ؤ|ئ|إ|أ|آ/g, ''],
  [/٠/g, '0'], [/١/g, '1'], [/٢/g, '2'], [/٣/g, '3'], [/٤/g, '4'],
  [/٥/g, '5'], [/٦/g, '6'], [/٧/g, '7'], [/٨/g, '8'], [/٩/g, '9'],
]
function slugify(input) {
  if (!input) return ''
  let s = input.replace(ARABIC_DIACRITICS, '')
  for (const [from, to] of TRANSLIT_MAP) s = s.replace(from, to)
  s = s.toLowerCase()
  const cleaned = s
    .trim()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return cleaned.substring(0, MAX_SLUG_LEN).replace(/-+$/, '')
}

const NON_LATIN = /[^a-z0-9-]/i

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
console.log('connected to postgres')

const { rows } = await client.query('SELECT id, title, slug FROM articles ORDER BY id')
console.log(`scanning ${rows.length} articles...`)

let changed = 0
let skipped = 0

for (const row of rows) {
  const current = String(row.slug || '')
  const looksLatin = !!current && !NON_LATIN.test(current) && !current.startsWith('http')

  if (looksLatin) {
    skipped++
    continue
  }

  const proposed = slugify(String(row.title || ''))
  if (!proposed) {
    console.log(`  ⨯ id=${row.id} could not derive a slug from title`)
    continue
  }

  // Uniqueness: suffix -2, -3 if needed
  let candidate = proposed
  let n = 1
  while (true) {
    const { rows: cf } = await client.query(
      'SELECT id FROM articles WHERE slug = $1 AND id <> $2 LIMIT 1',
      [candidate, row.id],
    )
    if (cf.length === 0) break
    n++
    candidate = `${proposed}-${n}`
  }

  await client.query('UPDATE articles SET slug = $1 WHERE id = $2', [candidate, row.id])
  console.log(`  ✓ id=${row.id}  ${current.slice(0, 30)}…  →  ${candidate}`)
  changed++
}

await client.end()
console.log(`\nDone. changed=${changed} skipped=${skipped}`)
process.exit(0)
