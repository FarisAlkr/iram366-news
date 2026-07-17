/*
 * IRAM 366 service worker — hand-rolled, no build step (served verbatim from
 * /public). Two jobs:
 *
 *   1. Web Push: receive `push` events and show the notification, open the
 *      article on click. This is what makes audience notifications work on
 *      Android/Chrome and installed iOS PWAs (16.4+).
 *   2. Minimal offline resilience + installability: a network-first handler
 *      for page navigations that falls back to a cached offline page. We do
 *      NOT cache article content — this is a news site and freshness beats
 *      offline reach; caching stories would risk serving stale headlines.
 *
 * Bump CACHE_VERSION when the precached shell (offline page / icons) changes
 * so old caches are cleaned on activate.
 */

const CACHE_VERSION = 'iram366-v1'
const PRECACHE = [`/offline.html`, `/icon-192.png`, `/icon-512.png`]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

// Only intercept top-level page navigations. Everything else (assets, API,
// admin, images) goes straight to the network untouched.
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || req.mode !== 'navigate') return

  event.respondWith(
    fetch(req).catch(() =>
      caches.match('/offline.html').then((cached) => cached || Response.error()),
    ),
  )
})

// Web Push: the server sends JSON { title, body, url, icon }.
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'إرم 366 الإخبارية', body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'إرم 366 الإخبارية'
  const url = payload.url || '/'
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: '/icon-192.png',
    lang: 'ar',
    dir: 'rtl',
    // Collapse repeat notifications for the same article into one entry.
    tag: url,
    renotify: true,
    data: { url },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Focus an already-open tab on the target URL, or open a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // Same-path tab already open → just focus it.
        if (new URL(client.url).pathname === new URL(targetUrl, self.location.origin).pathname) {
          return client.focus()
        }
      }
      return self.clients.openWindow(targetUrl)
    }),
  )
})
