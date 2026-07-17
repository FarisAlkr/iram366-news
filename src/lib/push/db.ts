import { Pool } from 'pg'

let pool: Pool | null = null

/**
 * Singleton Postgres pool for push-subscription fan-out. Kept separate from
 * Payload's adapter pool for the same reason the chatbot pool is (see
 * src/lib/chatbot/db.ts): the broadcast runs off the request path in
 * setImmediate, after the article's Payload transaction has committed, so it
 * must not reuse the request's connection.
 *
 * Sized small (3). Combined ceiling stays comfortable: Payload 15 + chatbot 5
 * + push 3 = 23, which even doubled during a deploy (old + new container) is
 * 46 — well under Postgres's default 100 max_connections. Same idle +
 * statement timeouts so a stuck send can't hold a connection open.
 */
export function getPushPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is required')
    pool = new Pool({
      connectionString: url,
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 30_000,
    })
  }
  return pool
}
