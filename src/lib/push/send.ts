import webpush, { type PushSubscription as WebPushSubscription } from 'web-push'

import { logger } from '../logger.ts'
import { getPushConfig } from './config.ts'
import { getPushPool } from './db.ts'

/**
 * Web-push fan-out service.
 *
 * Reads active browser subscriptions straight from Postgres (its own pool —
 * see ./db.ts) and pushes a notification to each. Runs off the request path
 * (the Articles hook schedules it via setImmediate), so it never blocks or
 * fails an editor's save. Dead subscriptions (404/410 from the push service)
 * are pruned by flipping `disabled_at` so they drop out of future sends.
 *
 * Native app tokens (platform ios/android, added in the Capacitor stage) are
 * intentionally excluded here — those go through FCM/APNs, not web-push. This
 * service only handles `platform = 'web'` rows.
 */

export interface PushMessage {
  title: string
  body: string
  /** Site-relative URL the notification opens on click, e.g. /articles/foo. */
  url: string
  icon?: string
}

interface SubRow {
  id: number
  endpoint: string
  p256dh: string
  auth: string
}

// web-push is stateless per call but setVapidDetails mutates module state; set
// it once per process on first use.
let vapidReady = false
function ensureVapid(): boolean {
  if (vapidReady) return true
  const cfg = getPushConfig()
  if (!cfg.enabled) return false
  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey)
  vapidReady = true
  return true
}

// Cap concurrent sockets so a large subscriber list can't exhaust file
// descriptors or the event loop on the 1-vCPU box.
const SEND_CONCURRENCY = 50

/**
 * Push a message to every active web subscriber for the given audience.
 *
 * @param message   the notification payload the service worker will render
 * @param breaking  when true, target every active web subscriber; when false,
 *                   only those who opted into all articles (topic = 'all').
 * @returns counts for logging: how many were sent vs pruned as dead.
 */
export async function broadcastWebPush(
  message: PushMessage,
  breaking: boolean,
): Promise<{ sent: number; pruned: number; total: number }> {
  if (!ensureVapid()) return { sent: 0, pruned: 0, total: 0 }

  const pool = getPushPool()
  // Breaking news reaches everyone; a normal publish only reaches subscribers
  // who asked for every article. `topic` is the subscriber's own preference.
  const rows = await pool.query<SubRow>(
    `SELECT id, endpoint, p256dh, auth
       FROM push_subscriptions
      WHERE disabled_at IS NULL
        AND platform = 'web'
        AND ($1 = true OR topic = 'all')`,
    [breaking],
  )

  const subs = rows.rows
  if (subs.length === 0) return { sent: 0, pruned: 0, total: 0 }

  const payload = JSON.stringify(message)
  const deadIds: number[] = []
  let sent = 0

  for (let i = 0; i < subs.length; i += SEND_CONCURRENCY) {
    const batch = subs.slice(i, i + SEND_CONCURRENCY)
    const results = await Promise.allSettled(batch.map((s) => sendOne(s, payload)))
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        sent += 1
      } else if (isGone(r.reason)) {
        deadIds.push(batch[idx]!.id)
      } else {
        logger.warn('push.send.failed', {
          subId: batch[idx]!.id,
          err: r.reason,
        })
      }
    })
  }

  const pruned = await pruneDead(deadIds)
  return { sent, pruned, total: subs.length }
}

function sendOne(sub: SubRow, payload: string): Promise<unknown> {
  const subscription: WebPushSubscription = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  }
  // TTL: hold the notification for up to 1h if the device is offline, then
  // drop it — stale breaking news past an hour is noise, not news.
  return webpush.sendNotification(subscription, payload, { TTL: 3600 })
}

/** 404 Not Found / 410 Gone → the subscription is permanently dead. */
function isGone(err: unknown): boolean {
  const code = (err as { statusCode?: number } | null)?.statusCode
  return code === 404 || code === 410
}

async function pruneDead(ids: number[]): Promise<number> {
  if (ids.length === 0) return 0
  try {
    const pool = getPushPool()
    await pool.query(
      `UPDATE push_subscriptions SET disabled_at = NOW() WHERE id = ANY($1::int[])`,
      [ids],
    )
    return ids.length
  } catch (err) {
    logger.error('push.prune.failed', { err, count: ids.length })
    return 0
  }
}
