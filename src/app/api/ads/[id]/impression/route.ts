import { NextResponse, type NextRequest } from 'next/server'

import { getChatbotPool } from '@/lib/chatbot/db'
import { logger } from '@/lib/logger'
import { RateLimits, enforce } from '@/lib/rate-limit'

interface RouteCtx {
  params: Promise<{ id: string }>
}

/**
 * Increments an ad's impression counter. Called fire-and-forget by the
 * AdSlot client component on first paint. Rate-limited per IP to prevent
 * inflation. Best-effort — failures don't surface to the user.
 *
 * Atomic raw SQL, deliberately bypassing payload.update() — same reasoning
 * as the article view counter: going through Payload wrote one audit-log
 * row per impression (several per page view) and its read-modify-write
 * lost increments under concurrent requests.
 */
export async function POST(req: NextRequest, { params }: RouteCtx) {
  const limited = enforce(req, RateLimits.view)
  if (limited) return limited

  const { id } = await params
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'bad id' }, { status: 400 })
  }

  try {
    const result = await getChatbotPool().query(
      `UPDATE ads
          SET impressions = COALESCE(impressions, 0) + 1
        WHERE id = $1 AND status = 'active'`,
      [Number(id)],
    )
    return NextResponse.json({ ok: true, skipped: result.rowCount === 0 })
  } catch (err) {
    logger.error('ads.impression.failed', { err, adId: id })
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
