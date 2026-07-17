/**
 * Browser-side Web Push helpers. Imported only by client components — never
 * touches server env (VAPID private key) or the pg pool. Every function is a
 * safe no-op in non-browser / unsupported contexts so callers don't need to
 * guard the environment themselves.
 */

const PUSH_ENABLED = process.env.NEXT_PUBLIC_PUSH_ENABLED === 'true'
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

export type PushTopic = 'all' | 'breaking'

export interface SubscribeResult {
  ok: boolean
  reason?: 'unsupported' | 'unconfigured' | 'denied' | 'error'
}

/** Feature is wired: flag on AND a public key was inlined at build time. */
export function isPushConfigured(): boolean {
  return PUSH_ENABLED && VAPID_PUBLIC_KEY.length > 0
}

/** The browser can do service workers + push + notifications. */
export function isPushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

/**
 * Register the service worker. Idempotent — the browser dedupes by scope, so
 * calling it on every mount is cheap. Returns null when unsupported/unconfigured.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushConfigured() || !isPushSupported()) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch (err) {
    console.error('[push] service worker registration failed', err)
    return null
  }
}

/**
 * Request permission and create (or reuse) the push subscription, then persist
 * it server-side. Must be called from a user gesture — browsers reject
 * Notification.requestPermission() otherwise.
 */
export async function subscribeToPush(topic: PushTopic = 'all'): Promise<SubscribeResult> {
  if (!isPushConfigured()) return { ok: false, reason: 'unconfigured' }
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { ok: false, reason: 'denied' }

    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    const subscription =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }))

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON(), topic }),
    })
    if (!res.ok) return { ok: false, reason: 'error' }
    return { ok: true }
  } catch (err) {
    console.error('[push] subscribe failed', err)
    return { ok: false, reason: 'error' }
  }
}

/** Drop the local subscription and tell the server to stop sending to it. */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false
  try {
    const reg = await navigator.serviceWorker.ready
    const subscription = await reg.pushManager.getSubscription()
    if (!subscription) return true
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    })
    await subscription.unsubscribe()
    return true
  } catch (err) {
    console.error('[push] unsubscribe failed', err)
    return false
  }
}

/** True when this browser already has an active push subscription. */
export async function hasActiveSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false
  try {
    const reg = await navigator.serviceWorker.ready
    return (await reg.pushManager.getSubscription()) !== null
  } catch {
    return false
  }
}

/**
 * Convert a base64url VAPID public key to the Uint8Array the Push API expects.
 * Standard boilerplate — the applicationServerKey must be raw bytes.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  // Back the view with a concrete ArrayBuffer (not ArrayBufferLike) so the
  // result satisfies BufferSource for pushManager.subscribe under TS's generic
  // typed-array types.
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}
