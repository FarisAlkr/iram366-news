import { Pool } from 'pg'

let pool: Pool | null = null

/**
 * Singleton Postgres pool for chatbot vector queries. Kept separate
 * from Payload's adapter pool so the raw pgvector SQL doesn't have to
 * negotiate Payload's drizzle layer.
 *
 * Pool sized smaller than Payload's (5 vs 15) — chatbot embedding
 * queries are infrequent compared to the read-side pages, and the
 * combined max (20) keeps both pools well under Postgres's default 100
 * max_connections even during a deploy with old + new app
 * side-by-side. Same idle + statement timeouts so a stuck embedding
 * write can't tie up a connection forever.
 */
export function getChatbotPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is required')
    pool = new Pool({
      connectionString: url,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 30_000,
    })
  }
  return pool
}
