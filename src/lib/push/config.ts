/**
 * Web-push feature configuration.
 *
 * Mirrors the chatbot config gate: the whole audience-notification feature is
 * a no-op unless `NEXT_PUBLIC_PUSH_ENABLED=true` AND a VAPID keypair is
 * present. When off (the default):
 *   • /api/push/subscribe and /api/push/unsubscribe return 404
 *   • the Articles afterChange push hook is a silent no-op
 *   • the client never registers a subscription
 *
 * VAPID keys authenticate this server to the browser push services (FCM,
 * Mozilla, WNS). Generate a pair once with:
 *   npx web-push generate-vapid-keys
 * Public key → NEXT_PUBLIC_VAPID_PUBLIC_KEY (browser, four-places env rule).
 * Private key → VAPID_PRIVATE_KEY (server only, two-places env rule).
 * VAPID_SUBJECT is a mailto: or https: contact the push service can reach.
 */

export interface PushConfig {
  enabled: boolean
  publicKey: string
  privateKey: string
  subject: string
}

/**
 * True only when the feature flag is on AND both VAPID keys are set. A missing
 * key with the flag on is a misconfiguration, not a reason to half-run — every
 * caller treats `false` as "feature off" and skips silently.
 */
export function isPushEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_PUSH_ENABLED === 'true' &&
    Boolean(process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) &&
    Boolean(process.env.VAPID_PRIVATE_KEY)
  )
}

export function getPushConfig(): PushConfig {
  // The public key is exposed to the browser as NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  // accept a server-only VAPID_PUBLIC_KEY alias too so the send path doesn't
  // depend on the NEXT_PUBLIC_ inlining having happened at build time.
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
  return {
    enabled: isPushEnabled(),
    publicKey,
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    // web-push requires a contact subject; default to the site's ops mailbox.
    subject: process.env.VAPID_SUBJECT || 'mailto:iramnews366@gmail.com',
  }
}
