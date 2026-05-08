import { NextResponse, type NextRequest } from 'next/server'

import { getPayloadClient } from '@/lib/payload'
import { logger } from '@/lib/logger'
import { RateLimits, enforce } from '@/lib/rate-limit'

interface RouteCtx {
  params: Promise<{ id: string }>
}

/**
 * Increments an ad's impression counter. Called fire-and-forget by the
 * AdSlot client component on first paint. Rate-limited per IP to prevent
 * inflation. Best-effort — failures don't surface to the user.
 */
export async function POST(req: NextRequest, { params }: RouteCtx) {
  const limited = enforce(req, RateLimits.view)
  if (limited) return limited

  const { id } = await params
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'bad id' }, { status: 400 })
  }

  try {
    const payload = await getPayloadClient()
    const ad = await payload.findByID({
      collection: 'ads',
      id: Number(id),
      depth: 0,
      overrideAccess: true,
    })
    const adData = ad as unknown as { impressions?: number; status?: string }

    if (!adData) return NextResponse.json({ ok: false }, { status: 404 })
    if (adData.status !== 'active') {
      return NextResponse.json({ ok: true, skipped: true })
    }

    await payload.update({
      collection: 'ads',
      id: Number(id),
      data: { impressions: (adData.impressions || 0) + 1 } as never,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error('ads.impression.failed', { err, adId: id })
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
