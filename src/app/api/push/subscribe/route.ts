import { NextResponse, type NextRequest } from 'next/server'

import { isPushEnabled } from '@/lib/push/config'
import { getPayloadClient } from '@/lib/payload'
import { RateLimits, enforce } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const MAX_ENDPOINT_LEN = 1024
const MAX_KEY_LEN = 256

interface SubscribeBody {
  subscription?: {
    endpoint?: unknown
    keys?: { p256dh?: unknown; auth?: unknown }
  }
  topic?: unknown
}

/**
 * Public endpoint: a browser registers its Web Push subscription so the site
 * can send it breaking-news notifications.
 *
 * 404s when the push feature flag / VAPID keys are off — defense in depth on
 * top of the client hiding the opt-in when the public key is absent.
 *
 * Idempotent: re-subscribing the same endpoint re-enables the row and refreshes
 * lastSeenAt rather than erroring on the unique-endpoint constraint.
 */
export async function POST(req: NextRequest) {
  if (!isPushEnabled()) {
    return NextResponse.json({ error: 'push disabled' }, { status: 404 })
  }

  const limited = enforce(req, RateLimits.push)
  if (limited) return limited

  let body: SubscribeBody
  try {
    body = (await req.json()) as SubscribeBody
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const sub = body.subscription
  const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint : ''
  const p256dh = typeof sub?.keys?.p256dh === 'string' ? sub.keys.p256dh : ''
  const auth = typeof sub?.keys?.auth === 'string' ? sub.keys.auth : ''

  // Endpoint must be an https push-service URL; the keys are the browser's
  // encryption material and are required for a web subscription.
  if (
    !endpoint ||
    endpoint.length > MAX_ENDPOINT_LEN ||
    !endpoint.startsWith('https://') ||
    !p256dh ||
    p256dh.length > MAX_KEY_LEN ||
    !auth ||
    auth.length > MAX_KEY_LEN
  ) {
    return NextResponse.json({ error: 'invalid subscription' }, { status: 400 })
  }

  const topic = body.topic === 'breaking' ? 'breaking' : 'all'
  const userAgent = req.headers.get('user-agent')?.slice(0, 512) ?? undefined

  try {
    const payload = await getPayloadClient()
    const existing = await payload.find({
      collection: 'push-subscriptions',
      where: { endpoint: { equals: endpoint } },
      limit: 1,
      overrideAccess: true,
    })

    const data = {
      endpoint,
      p256dh,
      auth,
      platform: 'web' as const,
      topic,
      userAgent,
      lastSeenAt: new Date().toISOString(),
      disabledAt: null,
    }

    const current = existing.docs[0] as { id: number | string } | undefined
    if (current) {
      await payload.update({
        collection: 'push-subscriptions',
        id: current.id,
        data,
        overrideAccess: true,
      })
    } else {
      await payload.create({
        collection: 'push-subscriptions',
        data,
        overrideAccess: true,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error('push.subscribe.failed', { err })
    return NextResponse.json({ error: 'subscribe failed' }, { status: 500 })
  }
}
