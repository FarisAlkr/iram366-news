import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Liveness probe for Docker / autoheal / uptime monitors.
 *
 * Deliberately does NOT touch the database. The previous healthcheck
 * (`/api/users`) hit Payload, which queried Postgres — when the pool
 * exhausted, the healthcheck itself hung, which is the same failure
 * mode that took the site down on 2026-05-10. A liveness probe must
 * answer "is this process responsive at the HTTP layer", not "is
 * every dependency healthy".
 *
 * If you want a deeper "readiness" check (DB reachable, R2 reachable,
 * etc.), add a separate `/api/ready` endpoint and only wire it up
 * to load-balancer routing decisions, never to autoheal.
 */
export function GET() {
  return NextResponse.json({ status: 'ok', ts: Date.now() })
}
