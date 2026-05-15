import { NextResponse } from 'next/server'

import { getChatbotPool } from '@/lib/chatbot/db'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const READINESS_TIMEOUT_MS = 3000

/**
 * Readiness probe — distinct from the liveness probe at /api/health.
 *
 * Returns 200 only when the app can actually serve requests end-to-end:
 * the Postgres pool answers SELECT 1, and R2 is reachable for media.
 * 503 with a small JSON breakdown otherwise so an external uptime
 * monitor can tell what's degraded.
 *
 * **Deliberately not wired to autoheal.** Liveness (does the process
 * respond) and readiness (do its dependencies work) are different
 * questions. A transient DB blip or R2 hiccup shouldn't trigger an
 * autoheal-restart of the app under traffic — the May 2026 pool-exhaustion
 * outage is the case study. Use this from UptimeRobot, a Slack webhook,
 * or a manual `curl /api/ready` during incident triage.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; ms?: number; error?: string }> = {}

  // DB: SELECT 1 via the chatbot pool (which is the smaller, independent
  // pool — avoids contending with Payload's hot pool when readiness is
  // probed under load).
  const dbStart = Date.now()
  try {
    const pool = getChatbotPool()
    await withTimeout(pool.query('SELECT 1'), READINESS_TIMEOUT_MS)
    checks.db = { ok: true, ms: Date.now() - dbStart }
  } catch (err) {
    checks.db = {
      ok: false,
      ms: Date.now() - dbStart,
      error: err instanceof Error ? err.message : 'unknown',
    }
  }

  // R2: HEAD against the public bucket origin. We don't require any
  // specific object to exist — just that the bucket endpoint resolves
  // and responds. If R2_PUBLIC_URL is unset, mark this check as skipped
  // rather than failing readiness (some envs deliberately run without R2).
  const r2Start = Date.now()
  const r2PublicUrl = process.env.R2_PUBLIC_URL
  if (!r2PublicUrl) {
    checks.r2 = { ok: true, ms: 0, error: 'skipped (R2_PUBLIC_URL unset)' }
  } else {
    try {
      const res = await withTimeout(
        fetch(r2PublicUrl, { method: 'HEAD', cache: 'no-store' }),
        READINESS_TIMEOUT_MS,
      )
      // A bucket origin returning 4xx (no path matched) is fine — it
      // proves the endpoint is reachable. 5xx or network errors are not.
      checks.r2 = {
        ok: res.status < 500,
        ms: Date.now() - r2Start,
        error: res.status >= 500 ? `HTTP ${res.status}` : undefined,
      }
    } catch (err) {
      checks.r2 = {
        ok: false,
        ms: Date.now() - r2Start,
        error: err instanceof Error ? err.message : 'unknown',
      }
    }
  }

  const allOk = Object.values(checks).every((c) => c.ok)
  if (!allOk) {
    logger.warn('readiness.degraded', { checks })
  }
  return NextResponse.json(
    {
      status: allOk ? 'ready' : 'degraded',
      ts: Date.now(),
      checks,
    },
    { status: allOk ? 200 : 503 },
  )
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)),
  ])
}
