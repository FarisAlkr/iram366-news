# Sentry setup — what Faris needs to do once

The code is already wired (`@sentry/nextjs`, `instrumentation.ts`, `instrumentation-client.ts`, `next.config.mjs` wrapped with `withSentryConfig`). With the env vars below unset the SDK is a no-op — the site behaves identically to before. To start receiving errors, follow these steps once.

## 1. Create the Sentry account (5 minutes)

1. Open [sentry.io](https://sentry.io/signup/) and sign up with `iramnews366@gmail.com`. The free **Developer** plan covers 5,000 errors/month + 10,000 performance events — plenty for the first months of real traffic.
2. When prompted, create:
   - **Organization slug:** `iram366` (or any handle — write down what you choose).
   - **Project:** pick "Next.js" as the platform, name it `iram366-news`.
3. After project creation Sentry shows a **DSN** that looks like `https://abc123@o4505000.ingest.sentry.io/4505999`. Copy it. The same DSN is used by both the server and the client.

## 2. Put the DSN on the production server

SSH to the VPS and edit `/opt/iram366/.env`:

```bash
ssh iram
cd /opt/iram366
nano .env
```

Add **two** lines (both can be the same DSN — distinct vars so we could swap one if we ever wanted to silence one runtime):

```env
SENTRY_DSN=https://...
NEXT_PUBLIC_SENTRY_DSN=https://...
```

Save, then rebuild + restart so the public token gets inlined into the browser bundle (`NEXT_PUBLIC_*` is a build-time inline in Next.js, not a runtime read):

```bash
docker compose up -d --build app
```

Wait ~1–2 minutes, then visit `https://iram366news.com/this-page-does-not-exist`. Within a minute the 404 should appear in the Sentry dashboard's "Issues" view. If you also see entries for `not-found.tsx` rendering, the client SDK is working too.

## 3. Optional — upload source maps from CI

The wrapper in `next.config.mjs` already uploads source maps when these three env vars exist at build time:

```env
SENTRY_ORG=iram366
SENTRY_PROJECT=iram366-news
SENTRY_AUTH_TOKEN=<token from sentry.io/settings/account/api/auth-tokens/>
```

Generate the auth token under **Settings → Account → API → Auth Tokens** with the `project:releases` scope. Add the three vars as GitHub Actions secrets (or set them in the VPS `.env` if builds happen on the VPS — they do today, per the Dockerfile).

Without these the SDK still captures errors, just with minified stack traces. That's fine for week one of launch; do it before any post-launch refactor that ships a lot of new code.

## 4. Tuning knobs

If the free-tier 5K/month event budget starts filling up:

- `instrumentation.ts` → `tracesSampleRate: 0.1` — drop performance traces (lower = fewer).
- `instrumentation-client.ts` → `tracesSampleRate: 0.05` — same for the browser.
- `replaysOnErrorSampleRate: 1.0` — replays are expensive; drop to `0` to disable entirely.

To kill Sentry temporarily without removing the integration, unset `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` and rebuild.

## 5. Things to verify the first week

- [ ] Errors from `/admin` (editor side) get captured — log in, click something broken on purpose.
- [ ] Errors from the public site get captured — visit a known-bad slug.
- [ ] 5K-event budget is healthy — check Sentry → Usage Stats after 7 days. If you're at >70%, lower the sample rates.
- [ ] Source maps are uploaded — open any captured error and confirm the stack trace shows TypeScript source, not minified JS.
