import { NextResponse, type NextRequest } from 'next/server'

import { getChatbotPool } from '@/lib/chatbot/db'
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
      status?: string
    }

    if (!adData?.targetUrl) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    // Defense in depth: the Ads.targetUrl field validator now rejects
    // non-https URLs at write time, but legacy rows from before that
    // landed could still carry a stale value, and a future migration bug
    // could re-introduce them. Re-checking the protocol at the redirect
    // boundary means this endpoint can never become an open redirect to
    // javascript:, data:, http:, or any other scheme regardless of DB state.
    let target: URL
    try {
      target = new URL(adData.targetUrl)
    } catch {
      logger.warn('ads.click.invalid_url', { adId: id, targetUrl: adData.targetUrl })
      return NextResponse.json({ error: 'invalid target' }, { status: 400 })
    }
    if (target.protocol !== 'https:') {
      logger.warn('ads.click.non_https_target', { adId: id, protocol: target.protocol })
      return NextResponse.json({ error: 'invalid target' }, { status: 400 })
    }

    // Don't count clicks on inactive ads. Atomic raw SQL instead of
    // payload.update() — see the impression route for why.
    if (adData.status === 'active') {
      getChatbotPool()
        .query(`UPDATE ads SET clicks = COALESCE(clicks, 0) + 1 WHERE id = $1`, [Number(id)])
        .catch((err) => logger.error('ads.click.update_failed', { err, adId: id }))
    }

    return NextResponse.redirect(target.toString(), 302)
  } catch (err) {
    logger.error('ads.click.failed', { err, adId: id })
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
