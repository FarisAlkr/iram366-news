import { NextResponse, type NextRequest } from 'next/server'

import { getPayloadClient } from '@/lib/payload'
import { logger } from '@/lib/logger'
import { RateLimits, enforce } from '@/lib/rate-limit'

interface RouteCtx {
  params: Promise<{ id: string }>
}

/**
 * Tracked click endpoint: increments the ad's click counter and 302-redirects
 * the user to the ad's target URL. Rate-limited per IP. Always succeeds with
 * a redirect (or 404 if the ad doesn't exist) — never an error to the user.
 */
export async function GET(req: NextRequest, { params }: RouteCtx) {
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

    const adData = ad as unknown as {
      targetUrl?: string
      clicks?: number
      status?: string
    }

    if (!adData?.targetUrl) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    // Don't count clicks on inactive ads
    if (adData.status === 'active') {
      payload
        .update({
          collection: 'ads',
          id: Number(id),
          data: { clicks: (adData.clicks || 0) + 1 } as never,
          overrideAccess: true,
        })
        .catch((err) => logger.error('ads.click.update_failed', { err, adId: id }))
    }

    return NextResponse.redirect(adData.targetUrl, 302)
  } catch (err) {
    logger.error('ads.click.failed', { err, adId: id })
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
