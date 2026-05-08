/**
 * In-memory token-bucket rate limiter.
 *
 * Per-key (typically IP+route) bucket of `capacity` tokens, refilled at
 * `refillPerSec`. One request consumes one token; over-budget callers receive
 * 429 with a `Retry-After` header set to the time until the next token.
 *
 * Trade-offs vs Redis: this is per-process. Behind multiple replicas you'll
 * effectively allow N×limit. For our single-instance VPS deploy that's fine.
 * Swap the storage engine (Map → Redis client) without touching call sites.
 */

import { logger } from './logger'

interface Bucket {
  tokens: number
  lastRefill: number
}

export interface RateLimitConfig {
  capacity: number
  refillPerSec: number
  prefix: string
}

const buckets = new Map<string, Bucket>()

// Best-effort eviction: every 5 minutes drop buckets we haven't seen for an
// hour to avoid unbounded growth.
const EVICT_INTERVAL_MS = 5 * 60 * 1000
const EVICT_MAX_AGE_MS = 60 * 60 * 1000
let evictTimer: ReturnType<typeof setInterval> | undefined
function startEvictor() {
  if (evictTimer || typeof setInterval !== 'function') return
  evictTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, b] of buckets) {
      if (now - b.lastRefill > EVICT_MAX_AGE_MS) buckets.delete(key)
    }
  }, EVICT_INTERVAL_MS)
  // Don't keep the process alive just for the evictor.
  evictTimer.unref?.()
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSec: number
}

export function consume(key: string, cfg: RateLimitConfig): RateLimitResult {
  startEvictor()
  const now = Date.now()
  const fullKey = `${cfg.prefix}:${key}`
  let b = buckets.get(fullKey)
  if (!b) {
    b = { tokens: cfg.capacity, lastRefill: now }
    buckets.set(fullKey, b)
  }

  // Refill based on elapsed time
  const elapsedSec = (now - b.lastRefill) / 1000
  if (elapsedSec > 0) {
    b.tokens = Math.min(cfg.capacity, b.tokens + elapsedSec * cfg.refillPerSec)
    b.lastRefill = now
  }

  if (b.tokens >= 1) {
    b.tokens -= 1
    return { allowed: true, remaining: Math.floor(b.tokens), retryAfterSec: 0 }
  }

  const retryAfterSec = Math.ceil((1 - b.tokens) / cfg.refillPerSec)
  return { allowed: false, remaining: 0, retryAfterSec }
}

/**
 * Resolve the client IP from common reverse-proxy headers, falling back to
 * 'unknown'. Caddy forwards X-Forwarded-For; any single-proxy hop will land
 * the original client IP at the front.
 */
export function clientIp(req: { headers: Headers }): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real.trim()
  return 'unknown'
}

/**
 * Convenience wrapper for Next.js Route Handlers. Returns a 429 Response if
 * the request should be denied, otherwise null.
 */
export function enforce(
  req: { headers: Headers },
  cfg: RateLimitConfig,
): Response | null {
  const ip = clientIp(req)
  const result = consume(ip, cfg)
  if (result.allowed) return null

  logger.warn('rate_limit.exceeded', {
    ip,
    route: cfg.prefix,
    retryAfterSec: result.retryAfterSec,
  })

  return new Response(JSON.stringify({ error: 'Too many requests' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(result.retryAfterSec),
      'X-RateLimit-Remaining': '0',
    },
  })
}

// Preset configs
export const RateLimits = {
  search: { prefix: 'search', capacity: 30, refillPerSec: 0.5 } satisfies RateLimitConfig,
  view: { prefix: 'view', capacity: 60, refillPerSec: 1 } satisfies RateLimitConfig,
  rss: { prefix: 'rss', capacity: 30, refillPerSec: 0.1 } satisfies RateLimitConfig,
  seed: { prefix: 'seed', capacity: 1, refillPerSec: 1 / 3600 } satisfies RateLimitConfig,
}
