# CLAUDE.md — IRAM 366 codebase guide

Operational onboarding for Claude (and future-you). Read top-to-bottom once; afterwards
skim "Reuse before you build" and "Don't repeat history" before any non-trivial change.

This file complements — does **not** replace — `README.md`, `CONTRIBUTING.md`,
`deploy/RUNBOOK.md`, and especially `docs/infrastructure-contracts.md`. When in doubt,
those are authoritative.

---

## 1. What this is

A production Arabic newsroom (RTL-native) for the Negev / Rahat region, live at
<https://iram366news.com>. Single-process Next.js 15 (App Router) + embedded Payload CMS 3,
Postgres 16 (pgvector), Cloudflare R2 for media, Caddy reverse proxy, all running as a
3-service Docker Compose stack on one VPS. CI builds and pushes the runtime image to GHCR;
GitHub Actions deploys via SSH + `docker compose pull`.

Solo maintainer. Treat production failures as on-call: a regression here means a real
newsroom can't publish.

---

## 2. Reuse before you build

**Always import from here before writing new utilities.** The codebase has many
intentional, battle-tested helpers; duplicating them is the most common mistake.

### Data access (`src/lib/queries.ts`)
- `getSiteSettings()` — React-cached, build-safe. Use this in every server component
  that needs settings; do NOT call `payload.findGlobal({ slug: 'site-settings' })` directly.
- `getCategories()` — wrapped in `unstable_cache` with tag `categories`; invalidated by
  `src/payload/hooks/revalidate.ts`.
- `getCategoryBySlug(slug)`, `getArticleBySlug(slug, { allowDraft })`,
  `listPublishedArticles(opts)`, `getWeatherTowns()` — same pattern.
- `CacheTags` — the canonical tag enum. If you add `unstable_cache`, register the tag here.
- Every helper short-circuits during `NEXT_PHASE === 'phase-production-build'` because
  Docker builds run without `DATABASE_URL`. Mirror this pattern in any new build-time-safe
  read.

### Payload client
- `getPayloadClient()` from `@/lib/payload` — the only correct way to get a Payload
  instance. Wraps `getPayload({ config })` and lets the framework dedupe.

### Logging
- `logger` from `@/lib/logger` — structured JSON to stdout, levels via `LOG_LEVEL`.
- **Never** `console.log` in committed code (ESLint will warn; CI runs `--max-warnings 0`).
  `console.warn` / `console.error` are allowed for genuine error paths but `logger.warn` /
  `logger.error` are preferred — they serialize `Error.cause`, attach service metadata,
  and produce one-line JSON for log aggregators.
- Event names follow `subject.verb` (`article.viewed`, `ads.click.failed`,
  `audit.write_failed`). Match that style for searchability.

### Rate limiting
- `enforce(req, RateLimits.X)` from `@/lib/rate-limit` at the **first line** of every
  public route handler. Returns a 429 Response when blocked; pass it straight back.
- Presets in `RateLimits`: `search`, `view`, `rss`, `seed`, `login`. Add new presets
  alongside; don't inline `consume()` config.
- Server Actions bypass `/api/*` route handlers, so they need explicit `enforce()` with a
  manually constructed `{ headers: await getHeaders() }` argument — see
  `src/app/(mobile)/m/login/actions.ts` for the pattern.

### Slug + Arabic text
- `slugify(title)`, `ensureSlug(title)`, `isValidSlug(s)`, `transliterate(ar)`,
  `normalizeArabic(s)` — all in `@/lib/slug`. Public-site slugs are Latin
  transliterations of the Arabic title (browser-friendly URLs).
- `normalizeArabic` is the search-side normalization that collapses letter variants
  (`أإآا → ا`, `ة → ه`, etc.). Always use it on the OR side when querying TEXT columns.

### Dates
- `relativeTime(date)`, `formatDate(date)`, `estimateReadTime(text)` from `@/lib/date`.
  Arabic locale baked in via `Intl.RelativeTimeFormat('ar')`.

### Article statistics (admin live widgets and persisted reading time)
- `computeStats(lexicalBody)` / `extractText(node)` / `countWords(text)` from
  `@/lib/article-stats`. The same helpers feed (a) the admin's live word/char/reading-time
  widget and (b) the `Articles.beforeChange` hook that persists `readingTime`. Don't
  reimplement Lexical traversal anywhere else.

### Video embeds
- `parseVideoUrl(raw)` + `aspectClass(aspect)` from `@/lib/video-embed`. Supports
  YouTube (incl. Shorts), TikTok, Instagram (post/reel/tv), X/Twitter, Facebook. Returns
  `{ platform, embedSrc, aspect }`. Add platforms here; don't inline regex elsewhere.

### Ads
- `getAdsForPlacements(['header-banner', 'sidebar-top', …], categoryId?)` from
  `@/lib/ads` — server-prefetches all active ads in one Postgres round-trip. Pass the
  result map into `<AdSlot ad={...}>`. **Never** add per-slot `/api/ads/active` fetches
  on a page that renders multiple slots (Sentry alert `JAVASCRIPT-NEXTJS-4` was the
  N+1 fanout we eliminated).

### Stats + Cloudflare Analytics
- `@/lib/stats/queries` — every aggregate the admin `/admin/stats` view uses, all
  `unstable_cache`d at 60s with tag `admin-stats`. Use these for any new admin metric.
- `@/lib/cloudflare-analytics` — `fetchSiteAnalytics({ since, until })` returns a typed
  RUM summary; null on missing creds. Cached 5 min.

### Chatbot (semantic search)
- All under `@/lib/chatbot`. `isChatbotEnabled()` gates everything; the whole feature is
  a no-op when `NEXT_PUBLIC_CHATBOT_ENABLED !== 'true'`.
- `embedText(text, 'document' | 'query')` + `vectorLiteral(vec)` — provider-agnostic
  (OpenAI/Voyage), 30s timeout wrapped in AbortController.
- `searchArticles(query, limit)` — pgvector cosine similarity.
- `getChatbotPool()` — separate `pg` Pool from Payload's, sized 5 (vs Payload's 15) so
  combined max stays well under Postgres's 100-connection cap during deploys.

### Types
- `@/types/payload` — the populated-relationship app types (`Article`, `Category`,
  `Media`, `SiteSettings`, …). Use these for UI consumption (depth ≥ 1).
- `Ref<T>` + `resolveRef<T>(ref)` — relationships in Payload responses can be either
  IDs or populated objects depending on depth. `resolveRef` collapses the union.
- `pickMediaUrl(media, 'card' | 'hero' | 'thumbnail' | 'full')` — picks the right
  Sharp-resized variant for the context; falls back to original.
- `src/payload-types.ts` is **auto-generated** by `payload generate:types`. Don't edit;
  it's gitignored from lint.

### Domain enums (`@/domain/enums`)
- `ArticleStatus`, `UserRole`, `AuditAction`, `HeroMode` — `as const` objects, not TS
  enums (clean erasure to string literals, works with Payload `select` field values).
  Match this pattern for any new enum.

### Access control (`@/payload/access`)
- `isAdmin`, `isEditor`, `isAuthor`, `isAdminOrEditor`, `isAuthenticated`, `isPublic`,
  `denied`, `isOwnerOrAdminEditor('author')`. **Always** use these in collection access
  configs — never re-implement the role check inline.

---

## 3. Conventions cheat sheet

| Rule | Detail |
|------|--------|
| Strict TS | `noUncheckedIndexedAccess`, `noImplicitOverride`, no implicit any. Prefer `as unknown as` to `as any` when crossing a Payload-typed boundary, with a one-line `// reason`. |
| No `console.log` | Use `logger.*`. `console.warn/error` allowed only for genuine fallback paths. |
| No silent catches | A `try/catch` with no logger call is a bug. |
| Server-first React | `'use client'` only when state/effects/browser APIs are required. |
| RTL-native CSS | Logical properties only: `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`. Never `ml-*`, `mr-*`, `text-left` (use `text-start`). |
| Imports | Absolute via `@/` alias (`@/lib/...`, `@/components/...`). Payload config alias is `@payload-config`. |
| File naming | kebab-case for `lib/`, PascalCase for components and React files. |
| Enums | `as const` objects, NOT TypeScript `enum`. |
| Comments | Default to none. Comment only when the WHY is non-obvious — a hidden constraint, a workaround, a tradeoff. Never re-state what the code does. |
| Commit format | Conventional Commits-ish: `feat(scope): ...`, `fix(scope): ...`, `chore(...)`, `docs(...)`. Keep subject ≤70 chars. |
| Co-author trailer | **Do NOT** add `Co-Authored-By: Claude` — solo maintainer's personal repo. |
| Pre-push | `npm run typecheck && npm run lint && npm test`. CI runs all three plus `npm run format:check`. |

---

## 4. Architecture map

```
src/
├── app/
│   ├── (frontend)/        Public Arabic site (RTL)
│   │   ├── layout.tsx     Loads fonts, JSON-LD org, signature UI flags, splash, chatbot
│   │   ├── page.tsx       Homepage — revalidate 60. Reads 7+ queries via Promise.all
│   │   ├── articles/[slug]/page.tsx          revalidate 120. NewsArticle JSON-LD
│   │   ├── category/[slug]/page.tsx          revalidate 60, paginated
│   │   ├── search/page.tsx                   revalidate 0 (always dynamic)
│   │   ├── preview/articles/[slug]/...       Live preview, gated by PAYLOAD_PREVIEW_SECRET
│   │   └── about/, contact/, privacy/, terms/, accessibility-statement/   revalidate 86400
│   ├── (mobile)/m/        Phone-friendly mini-CMS at /m (login + new article)
│   ├── (payload)/         Auto-generated Payload mounts (/admin and Payload's REST)
│   └── api/               Hand-rolled JSON routes (see §5)
├── components/            Shared UI for the public site (see catalogue below)
├── components/admin/      Custom Payload admin UI (cells, fields, dashboard view, etc.)
├── domain/enums.ts        ArticleStatus, UserRole, AuditAction, HeroMode
├── lib/
│   ├── queries.ts         Read-side data access (use this!)
│   ├── payload.ts         getPayloadClient()
│   ├── logger.ts          Structured JSON logger
│   ├── rate-limit.ts      Token bucket + enforce(req, RateLimits.X)
│   ├── slug.ts            Arabic transliteration + normalization
│   ├── date.ts            Arabic relative/formatted times
│   ├── ads.ts             Server-side ad prefetch (kills N+1 from per-slot fetches)
│   ├── article-stats.ts   Lexical → word/char/reading-time
│   ├── video-embed.ts     YouTube/TikTok/Instagram/X/Facebook URL parsing
│   ├── cloudflare-analytics.ts   RUM via Cloudflare GraphQL
│   ├── email-stub.ts      Stub email adapter (SMTP not yet wired)
│   ├── chatbot/           Vector search: config, embeddings, db (pg pool), search
│   └── stats/queries.ts   Aggregates for /admin/stats
├── payload/
│   ├── collections/       Articles, Users, Media, Categories, Pages, Series, Locations,
│   │                      Subscribers, Notifications, ArticleReviews, Ads, PageViews, AuditLog
│   ├── globals/           SiteSettings, WeatherTowns
│   ├── access/index.ts    Role-based predicates (use these, never inline)
│   ├── hooks/             audit, notify, embed-article, revalidate
│   └── migrations/sql/    Raw SQL migrations (chronological YYYYMMDD_HHMMSS_*.sql)
├── types/payload.ts       App-level populated types + Ref<T>/resolveRef
└── payload.config.ts      buildConfig(...) — push: dev only; pool tuned for 1-vCPU VPS

deploy/                    RUNBOOK.md, setup-vps.sh, deploy.sh, backup-postgres.sh, cron docs
docs/                      infrastructure-contracts.md (read this!), incidents/, audits
scripts/                   apply-migrations.sh, chatbot-setup.mjs, reslugify-articles.mjs
```

---

## 5. Custom API routes (cheatsheet)

All under `src/app/api/*`. The Payload REST API lives separately at `(payload)/api/[...slug]`.

| Route | Method | Purpose | Notes |
|---|---|---|---|
| `/api/articles/[slug]/view` | POST | Increment view counter | Atomic raw SQL on chatbot pool (bypasses Payload hooks to avoid audit/notify/embed fanout on every read). Cookie-deduped 1h. Best-effort `page-views` row. |
| `/api/search` | GET | Site search | `enforce(RateLimits.search)`. Arabic normalization OR clause. 2–80 char query. |
| `/api/feed/rss` | GET | RSS 2.0 feed | `dynamic = 'force-dynamic'`. CDATA escaped. 50 most recent. |
| `/api/seed` | POST | Re-seed sample content | Gated by `SEED_SECRET` header + `ALLOW_SEED_IN_PRODUCTION=1`. Constant-time secret compare. |
| `/api/chat` | POST | Chatbot vector search | `isChatbotEnabled()` returns 404 when disabled. Top-3 above 0.3 cosine similarity. |
| `/api/health` | GET | Liveness | **No DB!** Returns `{ status, ts, sha }`. Docker healthcheck wired here. |
| `/api/ready` | GET | Readiness | DB + R2 reachability. Returns 503 if degraded. Not wired to autoheal. |
| `/api/ads/active` | GET | Active ads for placement | Public; projects safe fields only. Use server-side `getAdsForPlacements` instead when possible. |
| `/api/ads/[id]/click` | GET | Tracked click + 302 | https-only target enforced both at field validator AND redirect boundary (defense in depth — prevent open-redirect). |
| `/api/ads/[id]/impression` | POST | Increment impressions | Fire-and-forget from `<AdSlot>` on first paint. |
| `/api/admin/hero-placement` | POST | Per-article hero slot | Auth via `payload.auth({ headers })`. Editor+ only. Writes `homepageHero` global with `overrideAccess: true`. |

**Conventions when adding a new route:**
1. First line: `const limited = enforce(req, RateLimits.X); if (limited) return limited`.
2. Validate input length + shape. Reject early with `NextResponse.json({ error }, { status: 400 })`.
3. Wrap external calls (Payload, fetch) in try/catch with `logger.error('event.failed', { err, ... })`.
4. Return shaped JSON: `{ error: '...' }` on failure, structured data on success.
5. If you need a new `RateLimits` preset, add it in `src/lib/rate-limit.ts` next to the others.

---

## 6. Cross-cutting patterns

### Cache + revalidation
- ISR cadences: home `60`, article `120`, category `60`, search `0` (dynamic), static
  pages `86400`. Sitemap `3600`.
- `getCategories` / `fetchSiteAnalytics` / `getArticleCounts` etc. use `unstable_cache`
  with named tags. **Invalidate via the hooks in `src/payload/hooks/revalidate.ts`** —
  the existing ones already cover Articles + Categories. Add new revalidate hooks there
  if you introduce a new cacheable collection.
- `getSiteSettings` does NOT use `unstable_cache` (just React `cache()`) — its
  invalidation is via `revalidatePath('/', 'layout')` in the `SiteSettings.afterChange`
  hook. Drops the whole frontend tree's cache.
- Never read `searchParams` inside a route that exports `revalidate`. Either set
  `dynamic = 'force-dynamic'` (e.g. `/search`, `/preview`) or only consume `params`.
- `generateStaticParams` must guard `process.env.NEXT_PHASE === 'phase-production-build'`
  and return `[]` — the Docker build has no `DATABASE_URL`.

### Audit log
- Every collection (except `audit-log` and `page-views`) calls `auditAfterChange` /
  `auditAfterDelete` from `src/payload/hooks/audit.ts`. Add them to any new collection's
  `hooks.afterChange` / `hooks.afterDelete`.
- Audit writes use `overrideAccess: true`; the `audit-log` collection has
  `create: denied` so no external POST can forge rows.

### Notifications
- `notifyOnArticleStatusChange` and `notifyOnReviewCreated` in
  `src/payload/hooks/notify.ts`. Pattern: detect transition, look up recipient, create a
  `notifications` row with `overrideAccess: true`. Never fail the user action because a
  notification failed — log and continue.

### Embeddings
- `embedArticleAfterChange` fires-and-forgets via `setImmediate(...)`. Synchronous wait
  on OpenAI/Voyage was the May 2026 outage path — keep it async. Guards INSERT with
  `WHERE EXISTS` against article delete races.

---

## 7. The five golden infrastructure rules

From `docs/infrastructure-contracts.md` — every PR-time outage in project history has
been a violation of one of these. Read the source doc in full before touching env vars,
Caddy, or schema.

1. **Every `NEXT_PUBLIC_*` var lives in four places**: `.env.example`,
   `docker-compose.yml services.app.environment`, `Dockerfile` builder ARG+ENV, and
   `deploy.yml` `build-args` (+ `gh secret set`). Skipping any → silent no-op in
   the browser bundle.
2. **Every server-side env var lives in two places**: `/opt/iram366/.env` AND
   `docker-compose.yml services.app.environment`. Compose has an explicit allowlist —
   `.env` alone is not forwarded.
3. **Every browser-originating external service** appears in Caddy's CSP — `script-src`
   for CDN JS, `connect-src` for fetch/XHR/WS, `frame-src` for iframes. The current
   `https:` wildcard masks omissions; add the explicit entry anyway.
4. **Every schema change has a `.sql` migration** under `src/payload/migrations/sql/`.
   Filename `YYYYMMDD_HHMMSS_<desc>.sql`. CI rejects schema-touching PRs without one;
   override token is `[skip-migration-check]` for label-only changes.
5. **Every deploy runs migrations before container swap**. `set -e` aborts the workflow
   on migration failure, the previous app keeps serving. Don't ad-hoc skip the migrate
   step.

---

## 8. Don't repeat history (gotchas)

### Schema and data
- `push: true` is **dev only**. `payload.config.ts` enforces this. Don't flip it back on
  in prod under any circumstance. (Cost: the 2026-05-11 outage. See
  `docs/incidents/2026-05-11-signature-ui-schema-mismatch.md`.)
- Article fields added to `Articles` collection also need columns added to `_articles_v`
  (versions table) — see `TODO.md` "flaky/TODO" section. Document this in any PR that
  adds an article field.
- Payload CLI's `payload migrate` does NOT work in this project — two stacked loader
  bugs (TS path aliases, `loadEnv.js` CJS interop). Use `scripts/apply-migrations.sh`.
  The `migrate:*` npm scripts that go through the Payload CLI are parked.

### Pool / API hygiene
- The view-counter route bypasses Payload's `update()` deliberately — routing it through
  Payload meant every page view fired `auditAfterChange`, `notifyOnArticleStatusChange`,
  and `embedArticleAfterChange` (paid API call!). Don't "fix" this by moving back.
- Payload pool: `max: 15`, statement_timeout 30s. Chatbot pool: `max: 5`. Combined
  under Postgres's default 100, leaving headroom for old+new app containers during
  deploys.
- `/api/health` is intentionally DB-free. If you add health/liveness probes, do not
  query Postgres from them.
- Open-redirect: `targetUrl` on `Ads` is validated to `https:` only at the field
  validator AND at the click redirect boundary. Keep both layers — legacy rows could
  carry stale values.

### Caddy
- Caddy reload via `SIGUSR1` does NOT pick up new `Caddyfile` content because Docker
  bind-mounts by inode. Use `docker compose up -d --no-deps --force-recreate caddy`
  instead — already wired in `deploy.yml`.

### Frontend
- Mobile-only ad breaks reuse sidebar slots (`lg:hidden` columns never reach phone
  readers); per-category sections on the homepage bucket from a single pooled query
  in JS — don't reintroduce per-category loops.
- Don't use raw `<img>` outside the live-preview page. ESLint warns on `<img>` (admin
  pages exempt because they're not Next.js pages). Use `next/image` and remember to
  add hostnames to `next.config.mjs` `images.remotePatterns`.
- Single-admin enforced both at the app level (Users `beforeValidate` hook) AND at the
  DB level (partial unique index `users_single_admin` in `deploy/postgres-init`). Don't
  rely on only one.

### Build
- `next build` runs without `DATABASE_URL` inside Docker. Every read-side helper falls
  back to safe empty values (`getSiteSettings → {}`, `listPublishedArticles → empty`).
  `IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build'` is the guard.

---

## 9. Common task recipes

### Add a field to a Payload collection
1. Edit the `.ts` file under `src/payload/collections/`.
2. Get a UTC timestamp: `date -u +%Y%m%d_%H%M%S`.
3. Create `src/payload/migrations/sql/<ts>_add_<field>.sql` with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`.
4. If the field is on `articles`, also add `ALTER TABLE _articles_v ADD COLUMN version_<name> ...` (versions table — see `TODO.md`).
5. Test locally: `docker compose up -d db && npm run migrate:sql`.
6. If you query the field via the local API, run `npm run generate:types`.
7. Commit collection edit + migration in the same PR; CI guard enforces it.

### Add a new API route
1. Pick or add a `RateLimits.*` preset in `src/lib/rate-limit.ts`.
2. Create `src/app/api/<path>/route.ts`.
3. First line: `const limited = enforce(req, RateLimits.X); if (limited) return limited`.
4. Validate input; reject early with `NextResponse.json({ error }, { status: 400 })`.
5. Wrap external calls in try/catch with `logger.error('<event>.failed', { err, ... })`.
6. Add a unit test if there's pure logic worth covering.

### Add a new public page
1. Create under `src/app/(frontend)/`.
2. Pick an ISR cadence (`export const revalidate = ...`). Static content → 86400, dynamic listings → 60–120.
3. Fetch via `@/lib/queries` helpers (don't call Payload directly).
4. Mount `Header` / `Footer`; both already read `getSiteSettings` themselves.
5. Add to `sitemap.ts` if SEO-relevant.

### Add a new `NEXT_PUBLIC_*` env var
Follow the four-locations recipe in §7 (also Section 2 of `docs/infrastructure-contracts.md`).

### Add a new server-side env var
Two locations: `/opt/iram366/.env` on the VPS + `services.app.environment` block in
`docker-compose.yml` as `NAME: ${NAME:-}`. Force-recreate the app container.

### Run migrations locally
```bash
docker compose up -d db
set -a && source .env && set +a
npm run migrate:sql
# or npm run migrate:sql:status
```

### Reseed sample data locally
```bash
ADMIN_PASSWORD=changeme npm run seed
```

---

## 10. Where to look when…

| Topic | Authoritative source |
|---|---|
| Architecture overview | `README.md` |
| Style + naming + commit format | `CONTRIBUTING.md` |
| Env-var / Caddy / migration rules | `docs/infrastructure-contracts.md` ← **read this** |
| Deploy / backup / restore | `deploy/RUNBOOK.md`, `docs/restore-from-backup.md` |
| Production incidents | `docs/incidents/` |
| Pre-launch / post-launch checklist | `docs/pre-launch-audit.md`, `docs/post-launch-backlog.md`, `TODO.md` |
| Sentry setup | `docs/sentry-setup.md` |
| Chatbot provisioning | `deploy/CHATBOT-SETUP.md` |
| SQL migration format | `src/payload/migrations/sql/README.md` |
| Roles & access matrix | `README.md` § "Roles & permissions" |
| Logo / icons / signature UI | `README.md` § "Signature UI" |
