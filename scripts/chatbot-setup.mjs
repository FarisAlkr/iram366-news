#!/usr/bin/env node
/**
 * One-time setup for the chatbot feature.
 *
 *   1. Enables the `vector` extension in Postgres.
 *   2. Creates the `article_embeddings` table with the right vector
 *      dimensions for the chosen embedding provider.
 *   3. Creates an ivfflat index for fast cosine-similarity search.
 *
 * Usage (run once on the VPS, AFTER setting EMBEDDINGS_PROVIDER and the
 * provider's API key in /opt/iram366/.env):
 *
 *   ssh iram "cd /opt/iram366 && docker compose exec app node scripts/chatbot-setup.mjs"
 *
 * Switching providers (OpenAI ↔ Voyage) means re-creating the table —
 * different providers have different dimensions, and pgvector does not
 * allow changing the column dimension in place. Drop and re-run, then
 * re-run chatbot-backfill.mjs.
 */

import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg

const provider = (process.env.EMBEDDINGS_PROVIDER || 'openai').toLowerCase()
const dim = provider === 'voyage' ? 1024 : 1536

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

try {
  console.log(`→ provider: ${provider} (dim=${dim})`)

  console.log('→ enabling pgvector extension...')
  await pool.query('CREATE EXTENSION IF NOT EXISTS vector')

  console.log('→ creating article_embeddings table...')
  await pool.query(`
    CREATE TABLE IF NOT EXISTS article_embeddings (
      article_id INTEGER PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
      embedding vector(${dim}) NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  // Verify dimension matches; if not, refuse so the user doesn't end up
  // with a mismatched table after switching providers.
  const dimRes = await pool.query(`
    SELECT atttypmod
    FROM pg_attribute
    WHERE attrelid = 'article_embeddings'::regclass AND attname = 'embedding'
  `)
  const existingDim = dimRes.rows[0]?.atttypmod
  if (existingDim && existingDim !== dim) {
    throw new Error(
      `existing article_embeddings has dim=${existingDim} but provider expects dim=${dim}. ` +
        'Drop the table (DROP TABLE article_embeddings;) and re-run setup, then re-run backfill.',
    )
  }

  console.log('→ creating cosine index (ivfflat, lists=50)...')
  await pool.query(`
    CREATE INDEX IF NOT EXISTS article_embeddings_cosine_idx
    ON article_embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 50)
  `)

  console.log('✓ chatbot setup complete')
} catch (err) {
  console.error('✗ setup failed:', err.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
