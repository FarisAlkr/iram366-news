import { Pool } from 'pg'

let pool: Pool | null = null

/**
 * Singleton Postgres pool for chatbot vector queries. Kept separate
 * from Payload's adapter pool so the raw pgvector SQL doesn't have to
 * negotiate Payload's drizzle layer.
 *
 * Same production tuning as the Payload pool — explicit max + idle and
 * statement timeouts so a stuck embedding write can't tie up a connection
 * forever.
 */
export function getChatbotPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is required')
    pool = new Pool({
      connectionString: url,
      max: 15,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 30_000,
    })
  }
  return pool
}
