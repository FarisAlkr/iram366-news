import { NextResponse, type NextRequest } from 'next/server'

import { isPushEnabled } from '@/lib/push/config'
import { getPayloadClient } from '@/lib/payload'
import { RateLimits, enforce } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const MAX_ENDPOINT_LEN = 1024

interface UnsubscribeBody {
  endpoint?: unknown
}

/**
 * Public endpoint: a browser drops its Web Push subscription (the reader turned
 * notifications off). Soft-disable by setting disabledAt so the row stays for
 * audience analytics but is excluded from every future send.
 *
 * Always answers { ok: true } for an unknown endpoint — unsubscribing something
 * already gone is success, not an error, and avoids leaking which endpoints
 * exist.
 */
export async function POST(req: NextRequest) {
  if (!isPushEnabled()) {
    return NextResponse.json({ error: 'push disabled' }, { status: 404 })
  }

  const limited = enforce(req, RateLimits.push)
  if (limited) return limited

  let body: UnsubscribeBody
  try {
    body = (await req.json()) as UnsubscribeBody
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : ''
  if (!endpoint || endpoint.length > MAX_ENDPOINT_LEN) {
    return NextResponse.json({ error: 'invalid endpoint' }, { status: 400 })
  }

  try {
    const payload = await getPayloadClient()
    await payload.update({
      collection: 'push-subscriptions',
      where: { endpoint: { equals: endpoint } },
      data: { disabledAt: new Date().toISOString() },
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error('push.unsubscribe.failed', { err })
    return NextResponse.json({ error: 'unsubscribe failed' }, { status: 500 })
  }
}
