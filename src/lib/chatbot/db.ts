import { Pool } from 'pg'

let pool: Pool | null = null

/**
 * Singleton Postgres pool for chatbot vector queries. Kept separate
 * from Payload's adapter pool so the raw pgvector SQL doesn't have to
 * negotiate Payload's drizzle layer.
 */
export function getChatbotPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is required')
    pool = new Pool({ connectionString: url, max: 4 })
  }
  return pool
}
