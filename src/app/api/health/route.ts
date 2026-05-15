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
 * For a dependency-aware readiness probe (DB + R2), see /api/ready.
 * That endpoint is deliberately NOT wired to autoheal — a transient
 * DB blip shouldn't restart the app under traffic.
 *
 * `sha` is the GitHub commit hash that produced this image (baked at
 * build time via the BUILD_SHA Dockerfile ARG). Surfaced so the deploy
 * workflow's smoke test can assert the running container's SHA matches
 * the SHA it just built — without this, a failed image pull would
 * silently keep serving the previous image while the smoke test passes.
 */
export function GET() {
  return NextResponse.json({
    status: 'ok',
    ts: Date.now(),
    sha: process.env.BUILD_SHA ?? 'unknown',
  })
}
