# Pre-launch verification audit — iram366news.com

**Branch:** `pre-launch-verification` (off `main`)
**Date:** 2026-05-13
**Scope:** read-only audit. No code changed. Findings are categorized at the end into 🔴 CRITICAL / 🟡 HIGH / 🟢 BACKLOG buckets to drive Phase 2.

A note on related in-flight work the auditor noticed before starting:

- `fix/admin-contrast-rebalance` exists on `main` and overlaps with the Phase 2.5 contrast task. Recommend merging or rebasing it into the Phase 2 PR rather than redoing the work.
- `feat/dashboard-visit-stats` exists and is unrelated to this audit.

---

## 1.1 Public-route smoke test

Local dev server (`npm run dev`, Next 15.4.11) at `http://localhost:3000`. All 8 testable routes returned **HTTP 200**.

| Route                              | Status | First-hit time | Notes                                                      |
| ---------------------------------- | ------ | -------------- | ---------------------------------------------------------- |
| `/`                                | 200    | 19.1 s         | Cold compile in dev; warm < 0.5 s. Prod build size 116 kB. |
| `/search`                          | 200    | 1.9 s          | Cold compile included.                                     |
| `/search?q=test`                   | 200    | 0.06 s         | Warm.                                                      |
| `/sitemap.xml`                     | 200    | 1.6 s          | Generated (see finding F-1.5-3).                           |
| `/robots.txt`                      | 200    | 0.3 s          | Disallow `/admin/` and `/api/`.                            |
| `/api/health`                      | 200    | 0.3 s          | Liveness-only, does not touch DB (good).                   |
| `/api/feed/rss`                    | 200    | 0.4 s          | RSS valid, CDATA-escaped.                                  |
| `/api/ads/active?placement=footer` | 200    | 0.4 s          |                                                            |

**Could not auto-test against real data.** The local dev DB (`iram-dev-db`) has zero articles and zero categories, so the audit did not exercise `/articles/[slug]`, `/category/[slug]`, or any real-slug rendering. These need to be spot-checked on the staging or production DB before launch (see "Verification gaps" at the bottom).

Server log during the smoke run had **one warning** and no errors:

```
WARN  No email adapter provided. Email will be written to console.
```

Expected — `SMTP_*` is not wired (see F-1.7-2).

---

## 1.2 Image references

Grepped `src/` for every `<Image>`, `<img>`, `backgroundImage`, and image-extension string.

**Static local paths** (verified each file exists under `public/`):

| Path                | Referenced from                                                                                                                               | Status   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `/splash-logo.jpeg` | `Header.tsx:70`, `SplashScreen.tsx:40`, `Chatbot.tsx:135`, `ShareButtons.tsx:96`, `m/login/page.tsx:16`, `m/new/page.tsx:32`, `m/page.tsx:87` | ✓ exists |
| `/logo.svg`         | `admin/Logo.tsx:13`, `admin/Icon.tsx:5`                                                                                                       | ✓ exists |

**Dynamic image sources** (CMS-driven, hostnames flow through R2):

- Article cover/avatar/gallery — via `pickMediaUrl()` on Payload `Media` records. R2-hosted.
- `FocalPointPicker.tsx:100`, `AdPreview.tsx:119`, `AnalyticsWidget.tsx:952` — same family.

**Whitelist** (`next.config.mjs:27-44`):

- `**.r2.dev` — public R2 dev URLs
- `**.cloudflare.com`
- `**.r2.cloudflarestorage.com`
- `**.iram366news.com` — custom CDN domain
- Dynamic `R2_PUBLIC_URL` host at runtime

**No unwhitelisted hosts, no missing local files.** Clean.

---

## 1.3 Internal-link resolution

Found every `<Link href=>` and `<a href="/...">` in `src/`. Hrefs map cleanly to existing routes:

- `/` → `src/app/(frontend)/page.tsx` ✓
- `/articles/${slug}` → `src/app/(frontend)/articles/[slug]/page.tsx` ✓
- `/category/${slug}` → `src/app/(frontend)/category/[slug]/page.tsx` ✓
- `/search?q=…` → `src/app/(frontend)/search/page.tsx` ✓
- `/m`, `/m/login`, `/m/logout`, `/m/new` → `src/app/(mobile)/m/...` ✓
- `/admin/...` (admin shortcuts inside `AnalyticsWidget`, `m/page`) → handled by Payload ✓

**No broken internal links.** Note: nothing in the codebase points to `/about`, `/contact`, `/privacy`, `/terms`, or `/accessibility-statement` — because none of those pages exist yet (see F-1.0-1).

---

## 1.4 Database queries on hot paths

### `src/app/(frontend)/page.tsx` (homepage)

- **F-1.4-1 — `force-dynamic` + ignored `revalidate=60`.** Lines 5 and 20. `force-dynamic` makes `revalidate` a no-op — every visitor hits Postgres. The inline comment claims it exists because DB isn't reachable during Docker build. That's the wrong fix — the right fix is to let the page be dynamic-at-build, ISR-cached at runtime (drop `force-dynamic`, keep `revalidate`). With hundreds of visits per day plus Cloudflare in front, this is a real cost on each cold cache miss.
- **F-1.4-2 — N+1 across categories.** Lines 96–110: `categories.map(async (cat) => payload.find({ where: category eq cat.id }))`. Parallelized via `Promise.all`, but still N independent queries (one per category, ~6 of them). On every render. A single grouped query (lateral join or window-function partition) would cut homepage Postgres traffic by ~5×.
- All `find()` calls have explicit `limit`. ✓
- All `depth` values are 0/1/2 — reasonable. ✓

### `src/app/(frontend)/articles/[slug]/page.tsx`

- **F-1.4-3 — `force-dynamic` + ignored `revalidate=120`.** Same pattern as homepage. Article pages are the most cacheable surface on the entire site; this is the highest-impact caching fix.
- `generateStaticParams()` (line 79) tries to pre-render top-50 articles. Combined with `force-dynamic` that's contradictory — Next.js currently marks the route SSG (`●` in build output) but emits dynamic rendering at request time.
- `fetchRelated` (line 95) — single bounded query. ✓
- Depth 1–2 on the related query. ✓

### `src/app/(frontend)/category/[slug]/page.tsx`

- `revalidate=60`, no `force-dynamic`. ✓ correctly configured for ISR.
- Single bounded query via `listPublishedArticles`. ✓

### Indexes (from `src/payload/migrations/20260511_192000_initial_baseline.ts`)

Indexed: `articles.slug` (UNIQUE), `category_id`, `status`, `is_breaking`, `is_featured`, `published_at`, `author_id`, `created_at`, `updated_at`, `deleted_at`, plus all `categories.slug`. Strong.

- **F-1.4-4 — `articles.views` not indexed.** Used as `sort: '-views'` on homepage "most-read". Sequential scan today; fine at low article counts, degrades linearly. Backlog.
- **F-1.4-5 — No trigram / GIN index on `articles.title` or `articles.excerpt`.** Search uses `title contains` (Postgres `ILIKE %q%`). Sequential scan. Fine at hundreds-of-articles scale; needs `pg_trgm` later. Backlog.

---

## 1.5 Caching strategy

| File                                          | `dynamic`       | `revalidate`  | Verdict                            |
| --------------------------------------------- | --------------- | ------------- | ---------------------------------- |
| `(frontend)/page.tsx`                         | `force-dynamic` | 60 (ignored)  | 🟡 — strip force-dynamic           |
| `(frontend)/articles/[slug]/page.tsx`         | `force-dynamic` | 120 (ignored) | 🟡 — strip force-dynamic           |
| `(frontend)/category/[slug]/page.tsx`         | —               | 60            | ✓                                  |
| `(frontend)/search/page.tsx`                  | —               | 0             | ✓ (search needs fresh)             |
| `(frontend)/preview/articles/[slug]/page.tsx` | `force-dynamic` | —             | ✓ (preview must skip cache)        |
| `api/health/route.ts`                         | `force-dynamic` | —             | ✓ (probe)                          |
| `api/feed/rss/route.ts`                       | `force-dynamic` | —             | ✓ (also sets Cache-Control: 300 s) |
| `sitemap.ts`                                  | `force-dynamic` | —             | ✓ (needs latest articles)          |
| `(mobile)/m/*`                                | `force-dynamic` | —             | ✓ (auth-gated admin-ish)           |

- **F-1.5-1 — Homepage caching broken.** See F-1.4-1.
- **F-1.5-2 — Article-page caching broken.** See F-1.4-3.
- **F-1.5-3 — `NEXT_PUBLIC_SITE_URL` fallback to `http://localhost:3000`.** `sitemap.ts:8`, `articles/[slug]/page.tsx:34`, `api/feed/rss/route.ts:12`. If this env var is missing on the production VPS, **the entire sitemap, RSS feed, and every article's canonical/OG URL will reference `localhost`** — Google indexes the wrong URLs, social previews break, RSS readers get bad links. Cannot verify production env from this audit; needs SSH or live-URL check.

---

## 1.6 API error handling

| Route                               | try/catch       | Status codes         | Bad-JSON guard      | Input sanitization                                | Verdict                           |
| ----------------------------------- | --------------- | -------------------- | ------------------- | ------------------------------------------------- | --------------------------------- |
| `api/search/route.ts`               | ⚠ no outer wrap | 200 only             | n/a (GET)           | bounded len + normalizeArabic + Payload local API | ⚠ minor — uncaught DB error → 500 |
| `api/chat/route.ts`                 | ✓ both layers   | 400/404/200          | ✓                   | length-checked                                    | ✓                                 |
| `api/health/route.ts`               | n/a (no IO)     | 200                  | n/a                 | n/a                                               | ✓                                 |
| `api/feed/rss/route.ts`             | ⚠ no outer wrap | 200 only             | n/a (GET)           | CDATA escape, no user input                       | ⚠ minor                           |
| `api/ads/active/route.ts`           | ✓               | 400/200/200-on-error | n/a (GET)           | placement whitelist, limit clamped                | ✓                                 |
| `api/ads/[id]/click/route.ts`       | ✓               | 400/404/302/500      | n/a (GET)           | id regex `^\d+$`                                  | ✓                                 |
| `api/ads/[id]/impression/route.ts`  | ✓               | 400/404/200          | n/a (POST, no body) | id regex                                          | ✓                                 |
| `api/articles/[slug]/view/route.ts` | ✓ both layers   | 400/404/500/200      | n/a (POST, no body) | `isValidSlug()`, raw SQL with parameter binding   | ✓                                 |
| `api/admin/hero-placement/route.ts` | ✓               | 400/401/403/404/500  | ✓                   | enum whitelist + auth + role check                | ✓                                 |
| `api/seed/route.ts`                 | ✓               | 401/403/200          | n/a                 | constant-time secret + NODE_ENV gate + rate limit | ✓                                 |

- **F-1.6-1 — `api/ads/[id]/click/route.ts:56` redirects to `adData.targetUrl` without protocol validation.** If an admin pastes a `javascript:` or other non-http(s) URL into an ad, this becomes an open-redirect/XSS vector. Admin-gated, so the blast radius is small, but a 1-line check (`new URL(targetUrl).protocol in {http:,https:}`) closes it. 🟢 backlog.
- **F-1.6-2 — `api/ads/[id]/impression/route.ts:40` read-modify-write race.** Two concurrent impressions can both read `impressions=N` and both write `N+1`, losing one count. Acceptable for an analytics counter; would matter if used for billing. 🟢 backlog.

---

## 1.7 Env-var audit

Vars referenced in `src/` and `scripts/` (via `process.env`):

```
ADMIN_PASSWORD, ALLOW_SEED_IN_PRODUCTION, CF_ACCOUNT_ID, CF_ANALYTICS_API_TOKEN,
DATABASE_URL, EMBEDDINGS_MODEL, EMBEDDINGS_PROVIDER, LOG_LEVEL, LOG_SERVICE,
NEXT_PUBLIC_CF_ANALYTICS_TOKEN, NEXT_PUBLIC_CHATBOT_ENABLED,
NEXT_PUBLIC_FEATURE_CURSOR_INK, NEXT_PUBLIC_FEATURE_FOOTER_CAMEL,
NEXT_PUBLIC_FEATURE_SOCIAL_HUB, NEXT_PUBLIC_SITE_URL, NODE_ENV, OPENAI_API_KEY,
PAYLOAD_PREVIEW_SECRET, PAYLOAD_SECRET, R2_ACCESS_KEY_ID, R2_ACCOUNT_ID,
R2_BUCKET, R2_PUBLIC_URL, R2_SECRET_ACCESS_KEY, SEED_SECRET, VOYAGE_API_KEY
```

- **F-1.7-1 — `.env.example` is missing 10 vars actually used in code.** A fresh-deploy operator following only `.env.example` will silently lose analytics, the chatbot, the social hub, and structured logging:

  | Missing from .env.example                                       | Used by                                               |
  | --------------------------------------------------------------- | ----------------------------------------------------- |
  | `CF_ACCOUNT_ID`, `CF_ANALYTICS_API_TOKEN`                       | server-side Cloudflare Analytics fetch (admin stats?) |
  | `NEXT_PUBLIC_CF_ANALYTICS_TOKEN`                                | client-side Cloudflare beacon                         |
  | `NEXT_PUBLIC_CHATBOT_ENABLED`, `NEXT_PUBLIC_FEATURE_SOCIAL_HUB` | feature flags for visible widgets                     |
  | `OPENAI_API_KEY`, `VOYAGE_API_KEY`                              | chatbot semantic search backends                      |
  | `EMBEDDINGS_PROVIDER`, `EMBEDDINGS_MODEL`                       | which embedding service to call                       |
  | `LOG_SERVICE`                                                   | logger tag                                            |

- **F-1.7-2 — `.env.example` documents 5 SMTP vars that no code actually reads.** `SMTP_HOST/PORT/USER/PASSWORD/FROM_*` aren't referenced anywhere in `src/`. Either remove from the template, or implement email (currently the dev log just says "No email adapter provided"). For launch, this means Payload password-reset emails do not work.
- **F-1.7-3 — No hardcoded secrets found.** Grepped for `sk-`, `pk_`, `AKIA`, `AIza`, `ghp_`, `xoxb`, `bearer …`, and `password=`/`secret=`/`key=` patterns — all clean.

---

## 1.8 Bundle sizes

`npm run build` succeeded with warnings. Per-route First Load JS:

| Route                      | Page    | First Load | Verdict                                  |
| -------------------------- | ------- | ---------- | ---------------------------------------- |
| `/`                        | 209 B   | **116 kB** | ✓                                        |
| `/articles/[slug]`         | 4.05 kB | **119 kB** | ✓                                        |
| `/category/[slug]`         | 211 B   | **116 kB** | ✓                                        |
| `/search`                  | 211 B   | **116 kB** | ✓                                        |
| `/m/new`                   | 3.1 kB  | 108 kB     | ✓                                        |
| `/preview/articles/[slug]` | 3.95 kB | 109 kB     | ✓                                        |
| `/admin/[[...segments]]`   | 12 kB   | **747 kB** | Payload CMS SPA — admin-only; acceptable |
| Shared by all              | —       | 102 kB     | ✓                                        |

All reader-facing routes are **well under the 250 kB ceiling** and below the 200 kB stretch target for the homepage. No obvious bloat to chase.

- **F-1.8-1 — Lockfile-resolution warning at every build.**
  ```
  ⚠ Found multiple lockfiles. Selecting /home/faris/package-lock.json.
  ```
  A stray `/home/faris/package-lock.json` (1.6 KB, declares `ramda` + `@types/ramda`, completely unrelated to this project) is being picked as the workspace root over the project's real `package-lock.json` (567 KB). Next.js infers a higher workspace boundary than intended. In a Docker build that copies only the project the warning never fires, but locally and on any hosting platform that respects the warning (Vercel, plain `next build` on the VPS), dependency tracing and output collation can pick the wrong root. Fix: `rm /home/faris/package-lock.json` — it's not in the project tree.
- **F-1.8-2 — Build emitted `Retrying 1/3 … Retrying 2/3` lines.** The retries appear to be from a network-bound build step (likely fetching a remote font or font-metadata). Build still completed in 43 s + finalize. Worth investigating once before launch so the production Docker build doesn't depend on intermittent network reachability. 🟢 backlog unless reproducible.
- **F-1.8-3 — Two pre-existing format violations on `main`.** `npm run format:check` flags `src/app/(payload)/admin/importMap.js` and `src/components/admin/ThemeToggle.tsx`. Both already fail on `main` before this branch was cut, so they are not blockers for _this_ audit, but `format:check` will fail in CI on any PR opened from `main`. Fix opportunistically in Phase 2 or as a one-line cleanup commit. `typecheck` and `lint --max-warnings 0` both pass clean.

---

## 1.9 Admin walk-through (static audit only)

Could not interact with `/admin` in a browser from this audit. Static review of the 13 Payload collections (`src/payload/collections/`) and 2 globals (`src/payload/globals/`):

- **Labels.** Every visible collection has Arabic `labels: { singular, plural }` _and_ per-field `label`. The only un-labeled collection is `PageViews.ts` — and it's `admin: { hidden: true }`, so editors never see it. ✓
- **Required indicators.** Every `required: true` field is rendered by Payload with its built-in required asterisk. Sampled `Articles.ts` — `title`, `excerpt`, `body`, `slug`, `status`, `category` are all `required: true`. ✓
- **Custom admin UI components.**
  - `AnalyticsWidget.tsx` (1,095 lines) — dashboard for the admin landing page.
  - `StatsView.tsx` (686 lines) — separate stats page.
  - `FocalPointPicker.tsx`, `AdPreview.tsx`, `WhatsAppShare.tsx`, `NotificationBell.tsx`, `KeyboardProvider.tsx` — field-level helpers.
- **F-1.9-1 — Admin contrast.** The user already flagged this and has a `fix/admin-contrast-rebalance` branch in flight. Phase 2.5 mandates the same work — recommend rebasing that branch into the Phase 2 PR rather than redoing it. **Recommend confirming this approach with the user before Phase 2 starts.**
- **F-1.9-2 — Live admin smoke test deferred.** The Phase-1 task script asks the auditor to actually click through (create article, upload image, set featured image, publish, save-as-draft, search). A code audit can't do that. This must be done in a browser before sign-off — by Faris or whoever is running QA. Listed as a verification gap below.

---

## 1.10 Mobile responsive (static audit only)

Could not test in a real browser at multiple widths. Static review of fixed-position UI:

- `Chatbot.tsx:127` — `fixed bottom-5 start-5 z-[60]`. In RTL the visual position is bottom-right.
- `SocialHub.tsx:215` — `fixed bottom-5 end-5 z-50`. In RTL the visual position is bottom-left.
- **The two FABs do not overlap each other** (opposite corners). ✓
- The chatbot open panel is `w-[min(92vw,380px)]` (`Chatbot.tsx:142`) — on a 375 px phone the panel is ~345 px wide, leaving ~30 px of side gutter. Fits.
- **F-1.10-1 — FAB occlusion of bottom content.** Both FABs sit at `bottom-5` (20 px). Article-page sticky elements (`ZoomControls`, `ShareButtons`) and the footer ad will sit under or beside them. Worth eyeballing in a real browser at 375 px — but no static evidence of broken layout.
- **F-1.10-2 — Phase 2.1 accessibility button position.** The Phase-2.1 instruction explicitly places the נגישות button in the footer (not floating) precisely so it doesn't stack into these two FABs. Note for the implementer: keep that constraint.
- **Visual responsive smoke (375 / 768 / 1440 px)** has to be done by a human. Listed as a verification gap.

---

## 1.0 — Missing entirely

These pages are referenced nowhere but are expected for a public news platform at launch:

- **F-1.0-1 — Accessibility statement (`/accessibility-statement`).** **Required by Israeli Regulation 35.** Phase 2.1 covers it.
- **F-1.0-2 — Privacy policy (`/privacy`).** Needed because the site collects analytics (Cloudflare), sets cookies (the view-dedup cookie at least), and offers a chatbot that processes user-supplied questions. Most likely also legally required in Israel for any consumer-facing news service.
- **F-1.0-3 — Contact page (`/contact`) or contact info.** No `/contact` route, no `mailto:` anywhere in user-facing components except the footer auto-link. A news site needs a clear "report a correction / send a tip" path.
- **F-1.0-4 — Terms of use (`/terms`).** Less critical than privacy but conventional. Holds editorial responsibilities, comment rules (when comments arrive), use-of-content terms.
- **F-1.0-5 — About page (`/about`).** Editorial mission, ownership disclosure. Conventional for credibility, especially for a news outlet. The footer mentions "إرم 366 الإخبارية" but there's no place a reader can land that explains who's behind the byline.

These were not listed in the original audit task; they're flagged here because they are obvious public-news-platform gaps that surface during a launch readiness review.

---

## Categorized triage

### 🔴 CRITICAL — blocks launch

- **F-1.0-1** — Accessibility statement page + נגישות widget (legal, Regulation 35). Already scoped in Phase 2.1.
- **F-1.0-2** — Privacy policy. Needed because site sets cookies and uses third-party analytics; legal/compliance call but very likely required.
- **F-1.5-3** — `NEXT_PUBLIC_SITE_URL` fallback to `localhost`. If this env var is unset on the production VPS, sitemap, RSS, and OG URLs all point at `localhost`. Verify the prod env on the VPS before launch.

### 🟡 HIGH — should fix before launch

- **F-1.4-1 / F-1.5-1** — Strip `force-dynamic` on the homepage; keep `revalidate=60`.
- **F-1.4-3 / F-1.5-2** — Strip `force-dynamic` on the article page; keep `revalidate=120`.
- **F-1.4-2** — Homepage per-category N+1 (one find per category). Refactor to a single query or accept the cost; lower priority than the caching fixes since once F-1.5-1 lands, this fires per ISR regeneration, not per visitor.
- **F-1.7-1** — `.env.example` is missing 10 actually-used vars. Update it. A deploy following the template silently loses analytics + chatbot.
- **F-1.7-2** — Decide on SMTP. Either remove the unused `SMTP_*` block from `.env.example`, or wire up the Payload email adapter so password-reset works.
- **F-1.8-1** — Delete the stray `/home/faris/package-lock.json`. (User action, outside the project tree — the audit cannot do this.)
- **F-1.9-1 / 2.5** — Admin contrast (already in `fix/admin-contrast-rebalance`; pull into Phase 2).
- **F-1.0-3 / F-1.0-4 / F-1.0-5** — About / Contact / Terms. Even minimal stubs are better than missing pages from the SEO/credibility standpoint.

### 🟢 BACKLOG — post-launch

- **F-1.4-4** — Add index on `articles.views` when row count grows past ~10 k.
- **F-1.4-5** — Add `pg_trgm` GIN index on `articles.title` + `articles.excerpt` once search latency becomes user-visible.
- **F-1.6-1** — `targetUrl` protocol allowlist on ad click redirect.
- **F-1.6-2** — Move ad impression counter to a single atomic UPDATE (matches the view-counter pattern).
- **F-1.8-2** — Investigate the `Retrying 1/3 / 2/3` lines in build output (likely a remote font fetch). Cache it locally if reproducible.
- **F-1.10-1** — Visually verify FAB stacking on a real 375 px phone after Phase 2.1 widget lands.

---

## Verification gaps — must be checked by a human before sign-off

1. **Real-data smoke test on staging or prod** — render `/articles/<real-slug>` and `/category/<real-slug>` for 3–5 published items. Local dev DB was empty.
2. **`NEXT_PUBLIC_SITE_URL` on the production VPS** — confirm the value is `https://iram366news.com` (or equivalent) and not unset. The fallback corrupts sitemap, RSS, and OG tags silently.
3. **Cloudflare Analytics token in production** — verify a real page view registers in the Cloudflare dashboard.
4. **Admin walk-through in a browser** — create one article, upload one image, set featured image, save as draft, publish, search inside admin, run the chatbot's article-embeddings preview. Watch for raw stack traces, missing labels, save buttons without feedback.
5. **Responsive QA at 375 px / 768 px / 1440 px** — homepage, article page, category page, search, with the chatbot and social-hub FABs both visible.

These gaps are not blocking the audit — but they are blocking launch. Phase 2 should not start until item 2 is verified (or accept the risk of fixing it later), and item 1 should be re-run on staging after Phase 2 fixes deploy.
