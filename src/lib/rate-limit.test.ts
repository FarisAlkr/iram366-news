import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { consume, enforce, RateLimits } from './rate-limit'

describe('rate-limit / consume', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-26T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows requests up to capacity', () => {
    const cfg = { prefix: 'test-burst', capacity: 3, refillPerSec: 0 }
    expect(consume('a', cfg).allowed).toBe(true)
    expect(consume('a', cfg).allowed).toBe(true)
    expect(consume('a', cfg).allowed).toBe(true)
    expect(consume('a', cfg).allowed).toBe(false)
  })

  it('refills tokens over time', () => {
    const cfg = { prefix: 'test-refill', capacity: 2, refillPerSec: 1 }
    consume('b', cfg)
    consume('b', cfg)
    expect(consume('b', cfg).allowed).toBe(false)
    vi.advanceTimersByTime(1500)
    expect(consume('b', cfg).allowed).toBe(true)
  })

  it('isolates buckets by key', () => {
    const cfg = { prefix: 'test-iso', capacity: 1, refillPerSec: 0 }
    expect(consume('x', cfg).allowed).toBe(true)
    expect(consume('y', cfg).allowed).toBe(true)
    expect(consume('x', cfg).allowed).toBe(false)
  })

  it('reports retry-after when blocked', () => {
    const cfg = { prefix: 'test-retry', capacity: 1, refillPerSec: 0.5 }
    consume('c', cfg)
    const blocked = consume('c', cfg)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSec).toBeGreaterThan(0)
  })
})

describe('rate-limit / enforce', () => {
  it('returns 429 with Retry-After when over budget', () => {
    const cfg = { prefix: 'test-enforce', capacity: 1, refillPerSec: 0 }
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.1' })
    const req = { headers }

    expect(enforce(req, cfg)).toBeNull()
    const blocked = enforce(req, cfg)
    expect(blocked).not.toBeNull()
    expect(blocked!.status).toBe(429)
    expect(blocked!.headers.get('Retry-After')).toBeTruthy()
  })
})

describe('rate-limit / preset configs', () => {
  it('exposes sane defaults', () => {
    expect(RateLimits.search.capacity).toBeGreaterThan(0)
    expect(RateLimits.view.capacity).toBeGreaterThan(0)
    expect(RateLimits.rss.capacity).toBeGreaterThan(0)
  })
})
