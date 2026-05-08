#!/usr/bin/env node
/**
 * Embed every published article and upsert into article_embeddings.
 *
 * Run this once after chatbot-setup.mjs. Going forward, the afterChange
 * hook on Articles handles new/updated articles automatically — backfill
 * is only needed for the initial bulk-load (or after switching providers
 * and re-creating the table).
 *
 * Usage:
 *   ssh iram "cd /opt/iram366 && docker compose exec app node scripts/chatbot-backfill.mjs"
 *
 * Reads EMBEDDINGS_PROVIDER, OPENAI_API_KEY or VOYAGE_API_KEY, and
 * DATABASE_URL from .env. Rate-limits requests gently (500ms between
 * articles) so we don't trip provider rate limits on a 500-article seed.
 */

import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg

const PROVIDER = (process.env.EMBEDDINGS_PROVIDER || 'openai').toLowerCase()
const MODEL = process.env.EMBEDDINGS_MODEL || (PROVIDER === 'voyage' ? 'voyage-3' : 'text-embedding-3-small')
const API_KEY = PROVIDER === 'voyage' ? process.env.VOYAGE_API_KEY : process.env.OPENAI_API_KEY
const MAX_INPUT_CHARS = 8000
const SLEEP_MS = 500

if (!process.env.DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1) }
if (!API_KEY) { console.error(`${PROVIDER.toUpperCase()}_API_KEY not set`); process.exit(1) }

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function lexicalToText(node) {
  if (!node || typeof node !== 'object') return ''
  if (node.root) return lexicalToText(node.root)
  let out = ''
  if (typeof node.text === 'string') out += node.text
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const piece = lexicalToText(child)
      if (piece) out += (out && !out.endsWith(' ') ? ' ' : '') + piece
    }
  }
  return out
}

async function embed(text) {
  const input = text.slice(0, MAX_INPUT_CHARS)
  if (PROVIDER === 'voyage') {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({ input, model: MODEL, input_type: 'document' }),
    })
    if (!res.ok) throw new Error(`voyage ${res.status}: ${await res.text()}`)
    const j = await res.json()
    return j.data[0].embedding
  }
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ input, model: MODEL }),
  })
  if (!res.ok) throw new Error(`openai ${res.status}: ${await res.text()}`)
  const j = await res.json()
  return j.data[0].embedding
}

const literal = (vec) => `[${vec.join(',')}]`

try {
  console.log(`→ provider: ${PROVIDER}, model: ${MODEL}`)

  const { rows: articles } = await pool.query(`
    SELECT id, title, excerpt, body
    FROM articles
    WHERE status = 'published'
      AND deleted_at IS NULL
      AND (published_at IS NULL OR published_at <= NOW())
    ORDER BY id
  `)
  console.log(`→ ${articles.length} published articles to embed`)

  let ok = 0, fail = 0
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i]
    const text = [a.title || '', a.excerpt || '', lexicalToText(a.body)].filter(Boolean).join('\n\n')
    if (!text.trim()) { console.log(`  [${i + 1}/${articles.length}] #${a.id} empty — skip`); continue }
    try {
      const vec = await embed(text)
      await pool.query(
        `INSERT INTO article_embeddings (article_id, embedding, updated_at)
         VALUES ($1, $2::vector, NOW())
         ON CONFLICT (article_id)
         DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = NOW()`,
        [a.id, literal(vec)],
      )
      ok++
      console.log(`  [${i + 1}/${articles.length}] #${a.id} ✓`)
    } catch (err) {
      fail++
      console.warn(`  [${i + 1}/${articles.length}] #${a.id} ✗ ${err.message}`)
    }
    if (i < articles.length - 1) await sleep(SLEEP_MS)
  }

  console.log(`✓ done — ${ok} embedded, ${fail} failed`)
} catch (err) {
  console.error('✗ backfill failed:', err.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
