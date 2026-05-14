# Session notes — 2026-05-14 (final pre-launch hardening)

End-of-session capture so tomorrow's session — whether the next developer or future-Faris — has full context without having to reconstruct the day from PR titles and commit logs. Read this top-to-bottom before resuming work; the TL;DR is in Section 9 if you only have 30 seconds.

---

## Section 1 — Where the project stands at end-of-session

### 1.1 Live in production today

**Main HEAD:** `32bf9d4` (Merge PR #51 — weekly docker auto-prune cron + logrotate, 2026-05-14 13:09 UTC).

**Site:** `https://iram366news.com` — TLS via Caddy + Let's Encrypt, DNS resolves directly to the VPS IP (grey-cloud through Cloudflare, not proxied through their edge).

#### Public routes (reader-facing)

| Route                               | What it does                                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`                                 | Homepage — hero, breaking-news ticker, latest articles, per-category sections, ads, social/most-read sidebar                                                             |
| `/articles/[slug]`                  | Article detail — body, hero image, gallery, share buttons, related articles, JSON-LD NewsArticle schema                                                                  |
| `/category/[slug]`                  | Category index — paginated list of all articles in one category                                                                                                          |
| `/search?q=…`                       | Search — Arabic-normalized title + excerpt match via Payload's `contains` operator                                                                                       |
| `/about`                            | About page — editorial mission, region focus, structure links. Contains `[TODO]` placeholders for editorial team list + ח.פ. + postal address                            |
| `/contact`                          | Contact page — channels for editorial, accessibility, privacy, ads, legal. Contains `[TODO]` placeholders for legal email + postal address + ח.פ.                        |
| `/privacy`                          | Privacy policy — Israeli Privacy Protection Law (1981) + GDPR. Contains `[TODO]` placeholders for privacy officer name + postal address + ח.פ.                           |
| `/terms`                            | Terms of use — IP rights, sharing rules, liability, governing law (Israel). Contains `[TODO]` placeholders for legal email + postal address + ח.פ.                       |
| `/accessibility-statement`          | Bilingual Arabic + Hebrew accessibility statement per Regulation 35. Contains `[TODO]` placeholders for accessibility coordinator name + landline phone + postal address |
| `/preview/articles/[slug]?secret=…` | Live-preview rendering of a draft article. Secret-gated.                                                                                                                 |
| `/sitemap.xml`                      | Auto-generated sitemap of all published articles + categories + pages                                                                                                    |
| `/robots.txt`                       | Disallows `/admin/` and `/api/`; references sitemap                                                                                                                      |
| `/manifest.webmanifest`             | PWA manifest                                                                                                                                                             |

#### Public-facing API routes

| Route                             | What it does                                                        |
| --------------------------------- | ------------------------------------------------------------------- |
| `GET /api/health`                 | DB-free liveness probe — returns `{ status: 'ok', ts: <ms> }`       |
| `GET /api/search?q=…`             | Public search endpoint (same logic as `/search` page)               |
| `GET /api/feed/rss`               | RSS 2.0 feed of latest 50 published articles                        |
| `GET /api/ads/active?placement=…` | Returns currently-active ads for a placement zone                   |
| `GET /api/ads/[id]/click`         | Tracks click + 302-redirects to the ad's target URL                 |
| `POST /api/ads/[id]/impression`   | Tracks impression (fire-and-forget from client)                     |
| `POST /api/articles/[slug]/view`  | Atomic view-count increment with 1h cookie dedup                    |
| `POST /api/chat`                  | Chatbot endpoint — semantic article search via pgvector             |
| `POST /api/seed`                  | Re-seed sample content (gated by `SEED_SECRET` + non-prod NODE_ENV) |
| `POST /api/admin/hero-placement`  | Editor-role endpoint to set per-article hero placement              |

#### Admin features (Payload CMS at `/admin`)

Gated by Payload's session cookie; reachable only after `/admin/login`. Three roles: Admin / Editor / Author.

**Collections:**

- Articles (with versioning, scheduled publishing, gallery, tags, locations, hero placement)
- Categories
- Media (uploaded to R2 via the s3 storage plugin)
- Users
- Ads
- Pages (generic content pages — not the legal pages, those are routed in app/)
- Series
- Locations
- Subscribers
- Notifications
- ArticleReviews (editorial workflow)
- PageViews (analytics timeseries, hidden from admin UI)
- AuditLog (hidden from admin UI)

**Globals:**

- `site-settings` (site name, logo, social links, hero placement, footer text, signature-UI toggles, social-hub toggle)
- `weather-towns` (header weather-city picker towns)

**Custom admin surfaces:**

- Dashboard widget (`AnalyticsWidget.tsx`) — content KPIs + recent activity + draft/published/archived counts
- Stats page at `/admin/stats` (`StatsView.tsx`) — editorial stats (top articles, authors, categories, tag cloud, dow activity, time-to-publish) PLUS Cloudflare Web Analytics panel (KPI cards, top paths, top referrers, 14-day trend chart)
- Bulk gallery uploader on the article create/edit form
- Per-article hero placement picker (Main / Secondary 1–3 / None)
- Theme toggle (light/dark) in the admin top corner
- Onboarding tour
- Notification bell (drafts + reviews queue)
- Keyboard shortcuts provider
- Mobile editor at `/m/login` / `/m` / `/m/new` (phone-optimized create-article flow)

#### External integrations active

| Service                            | What it does                                                                                                                                                                                                                                                                                                                                                                      | Status                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Cloudflare R2**                  | Object storage for the Payload `media` collection. Bucket `iram366-media`. Public CDN at `media.iram366news.com`. Also hosts Postgres backups under `postgres/{daily,weekly,monthly}/` (same bucket, different prefix).                                                                                                                                                           | ✅ Live                                                                     |
| **Cloudflare Web Analytics**       | Privacy-first beacon loaded via `static.cloudflareinsights.com/beacon.min.js`. Beacon token in `NEXT_PUBLIC_CF_ANALYTICS_TOKEN`. Server-side queryable via `rumPageloadEventsAdaptiveGroups` GraphQL with `CF_ANALYTICS_API_TOKEN` + `CF_ACCOUNT_ID`. Admin "إحصاءات" widget surfaces today/week pageviews + visitors, top paths/referrers (14d), and a 14-bar daily trend chart. | ✅ Live                                                                     |
| **Cloudflare DNS**                 | Authoritative DNS for `iram366news.com`. Grey-cloud (not proxied through CF edge — Caddy on the VPS is the front-most TLS terminator). `media.iram366news.com` CNAME → R2.                                                                                                                                                                                                        | ✅ Live                                                                     |
| **Sentry**                         | Error monitoring via `@sentry/nextjs` v10.53.1. EU-region DSN. Server-side init in `instrumentation.ts`, browser init in `instrumentation-client.ts`. `NEXT_PUBLIC_SENTRY_DSN` build-arg wired through GH Actions secret → Dockerfile → bundle. Sample rates: 10% server traces, 5% client traces, 0% session replay (errors only).                                               | ✅ Live; trial expires ~2026-05-28 (auto-downgrades to free Developer plan) |
| **UserWay**                        | Accessibility widget loaded async from `cdn.userway.org/widget.js` when `NEXT_PUBLIC_USERWAY_ACCOUNT_ID` is set. Account ID `zreM14h1u3`. Auto-injected trigger button is CSS-hidden (`globals.css`); the in-footer button uses `window.UserWay.openWidget()`. CSP allows the host in `script-src`, `style-src`, `font-src`.                                                      | ✅ Live                                                                     |
| **OpenAI**                         | Embeddings provider for the chatbot semantic search (`text-embedding-3-small`). Configured via `EMBEDDINGS_PROVIDER=openai` + `OPENAI_API_KEY`. Pay-as-you-go — fractions of a cent per article.                                                                                                                                                                                  | ✅ Live                                                                     |
| **Voyage AI**                      | Alternative embeddings backend — code-supported via `EMBEDDINGS_PROVIDER=voyage` + `VOYAGE_API_KEY` but **not active**. Kept as a swap option.                                                                                                                                                                                                                                    | ⏸️ Not in use                                                               |
| **GitHub (code + GHCR + Actions)** | Repo `FarisAlkr/iram366-news`. Container registry `ghcr.io/farisalkr/iram366-app`. CI workflow (`ci.yml`) + Build & Deploy workflow (`deploy.yml`) both green and operating on bumped action versions (PR #39).                                                                                                                                                                   | ✅ Live                                                                     |
| **Hostinger VPS**                  | `srv1574265` at `187.124.219.77`. Ubuntu 24.04 LTS, 1 vCPU, 3.8 GiB RAM, 48 GB disk (currently 26% used after today's cleanup). SSH alias `iram`.                                                                                                                                                                                                                                 | ✅ Live                                                                     |
| **SMTP / outbound email**          | **Not wired.** Stub adapter at `src/lib/email-stub.ts` throws `"هذه الميزة قيد التطوير حالياً..."` instead of pretending password-reset emails went out. Formally deferred via PR #49 — three implementation paths documented in `docs/post-launch-backlog.md`.                                                                                                                   | ⏸️ Deferred                                                                 |

#### Backup status

| Aspect              | Detail                                                                                                                                                                                                                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Schedule**        | Daily at 03:00 UTC via cron entry on the VPS                                                                                                                                                                                                                                                                                                              |
| **Script**          | `/opt/iram366/scripts/backup-postgres.sh` (mirrored in repo at `scripts/backup-postgres.sh`)                                                                                                                                                                                                                                                              |
| **Destination**     | `s3://iram366-media/postgres/{daily,weekly,monthly}/iram366-YYYY-MM-DD-HHMMSS.sql.gz`                                                                                                                                                                                                                                                                     |
| **Retention**       | 7 daily + 4 weekly (Sundays) + 3 monthly (1st of month) = ~14 files at steady state, ~14 MB total                                                                                                                                                                                                                                                         |
| **Verification**    | Post-upload `aws s3 ls` round-trip checks size >0; non-zero exit on failure                                                                                                                                                                                                                                                                               |
| **Restore tested?** | **Yes — 2026-05-14 12:33 UTC.** Downloaded `iram366-2026-05-14-122441.sql.gz`, restored into a temp database `iram366_restore_test`, verified row counts against prod: articles=70, users=1, categories=11, site_settings=1, payload_migrations=4, media=157 — **all six tables matched exactly**. Procedure documented in `docs/restore-from-backup.md`. |
| **Legacy files**    | 10 pre-PR-#50 backups still in `s3://iram366-media/backups/YYYY/MM/DD/` from before the layout change. Same format (gzipped pg_dump). Will age out of the old 30-day window naturally. Restorable from too.                                                                                                                                               |

### 1.2 Open issues / TODOs

#### `[TODO:]` markers in code (Arabic + Hebrew, visible to readers)

19 markers across 5 files. All are **client-supplied data the developer can't invent**.

| File                                                  | Line | Marker (translated summary)                                               |
| ----------------------------------------------------- | ---- | ------------------------------------------------------------------------- |
| `src/app/(frontend)/about/page.tsx`                   | 72   | Editorial team roster — names, roles, bios, optional photos + social URLs |
| `src/app/(frontend)/about/page.tsx`                   | 114  | Company registration number (ח.פ.) for transparency display               |
| `src/app/(frontend)/about/page.tsx`                   | 115  | Official postal mailing address                                           |
| `src/app/(frontend)/accessibility-statement/page.tsx` | 112  | Arabic — accessibility coordinator name (legally required)                |
| `src/app/(frontend)/accessibility-statement/page.tsx` | 124  | Arabic — alternative landline phone (or instruction to delete the line)   |
| `src/app/(frontend)/accessibility-statement/page.tsx` | 128  | Arabic — postal address for written complaints                            |
| `src/app/(frontend)/accessibility-statement/page.tsx` | 203  | Hebrew — accessibility coordinator name (parallel of L112)                |
| `src/app/(frontend)/accessibility-statement/page.tsx` | 215  | Hebrew — alternative landline phone (parallel of L124)                    |
| `src/app/(frontend)/accessibility-statement/page.tsx` | 218  | Hebrew — postal mailing address (parallel of L128)                        |
| `src/app/(frontend)/contact/page.tsx`                 | 144  | Optional dedicated legal-contact email                                    |
| `src/app/(frontend)/contact/page.tsx`                 | 147  | Official postal mailing address                                           |
| `src/app/(frontend)/contact/page.tsx`                 | 160  | Company registration number (ח.פ.)                                        |
| `src/app/(frontend)/contact/page.tsx`                 | 161  | Official postal mailing address (second occurrence)                       |
| `src/app/(frontend)/privacy/page.tsx`                 | 172  | Privacy officer name (optional under Israeli law)                         |
| `src/app/(frontend)/privacy/page.tsx`                 | 184  | Official postal mailing address                                           |
| `src/app/(frontend)/privacy/page.tsx`                 | 188  | Company registration number (ח.פ.)                                        |
| `src/app/(frontend)/terms/page.tsx`                   | 156  | Dedicated legal-contact email (or default to public address)              |
| `src/app/(frontend)/terms/page.tsx`                   | 164  | Company registration number (ח.פ.)                                        |
| `src/app/(frontend)/terms/page.tsx`                   | 165  | Official postal mailing address                                           |

**Consolidating:** these reduce to **5 distinct pieces of info** the client must supply (each then propagates across all the pages that need it):

1. Accessibility coordinator name (legally required)
2. Postal mailing address (referenced 8 times across the four pages)
3. Company registration number ה ח.פ. (referenced 6 times)
4. Editorial team roster for `/about`
5. Optional: privacy officer name, optional legal-contact email, optional landline phone

#### Items still in `docs/post-launch-backlog.md`

Just one entry today: **SMTP / password-reset email** — formally deferred via PR #49 with three implementation paths spec'd. Re-evaluation triggers documented.

#### Other known-not-done

- **🔴 Cloudflare Analytics token rotation** — `CF_ANALYTICS_API_TOKEN` value (token name `iram366-analytics-read`) was pasted in chat during initial wire-up. Read-only on analytics so blast radius is small. Roll from `https://dash.cloudflare.com/profile/api-tokens` → ⋯ → Roll, then replace in `/opt/iram366/.env` and `docker compose up -d --no-deps --force-recreate app`.
- **Sentry source-map upload** — would de-minify stack traces in the Sentry dashboard. Set `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` as GH Actions secrets and the existing `withSentryConfig` wrapper picks them up. `docs/sentry-setup.md` has the recipe.
- **Build-cache pruning cron** — today's manual cleanup recovered 26.57 GB from build cache. The Sunday weekly cron is **image-only** (deliberate conservative call). If disk usage creeps past ~60% in coming weeks, add the one-liner `30 4 * * 0  docker builder prune -af --filter "until=168h" >> /var/log/iram366-docker-prune.log 2>&1` per `deploy/cron-entries.md`.
- **Smoke-test CSP assertion** — the deploy workflow's smoke test only checks `/ → 200`. It would have passed during the PR #41 deploy that broke the UserWay CSP. Extending to grep for specific header values would catch this class of bug at deploy-time. Discussed in PR #42; not in scope for any open work.
- **Real YouTube + Telegram URLs** in `/admin → إعدادات الموقع → روابط التواصل الاجتماعي`. Currently the generic `https://www.youtube.com/` and `https://web.telegram.org/k/`. These appear in the footer, social hub, and JSON-LD `sameAs[]`. Either point to real channels or clear the fields.
- **Footer copyright year** — DB `footerText` field currently says "© 2025"; should be 2026. Pure content fix in `/admin`.

### 1.3 Waiting on external input

- **Client legal info** — the 5 consolidated TODO items above. WhatsApp request status to client: not tracked here.
- **Sentry trial expiry** — Business trial auto-downgrades to free Developer plan ~**2026-05-28** (5K errors/month + 10K perf events). Should be transparent. Check Sentry → Usage Stats after expiry; if events approach the cap, reduce `tracesSampleRate` in `instrumentation-client.ts`.
- **Hostinger VPS renewal date** — unknown. Faris to look up in the Hostinger panel. If auto-renew isn't on, the site disappears when it lapses.
- **Domain registrar renewal** — unknown. Faris to confirm whether `iram366news.com` is registered through Hostinger or an external registrar.
- **GitHub 2FA backup codes** — Faris to confirm they're stored somewhere recoverable (1Password, printed, safe). Repo visibility currently private — decision pending on whether to add client as collaborator.

---

## Section 2 — Today's PR ledger

All 14 PRs merged on 2026-05-14, in chronological order:

| PR  | Merge SHA | Title                                                                                            | Purpose                                                                                                                                                                                                                                                       | Outcome                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | --------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #38 | `01ddbcd` | pre-launch: phase 2 — critical & high findings + a11y + SEO + monitoring + legal pages + content | The biggest single drop — Phase 2 of the launch audit. ISR fix, N+1 collapse, env.example coverage, SMTP stub, UserWay statement page, 4 legal pages, Sentry skeleton.                                                                                        | 9 commits, ~3,000 LOC added. Shipped clean; subsequent same-day PRs followed up on three skipped wires.                                                                                                                                                                                                                                                                                                                 |
| #39 | `49d414b` | chore(actions): bump deprecated GitHub Actions versions ahead of 2026-06-02 cutoff               | Pre-emptively upgrade all 3rd-party actions to versions using Node 24 runtime, ahead of GitHub's Node 20 deprecation.                                                                                                                                         | All 7 actions bumped (`actions/checkout` v4→v6, `setup-node` v4→v6, `docker/setup-buildx` v3→v4, `docker/login` v3→v4, `docker/build-push` v6→v7, `appleboy/scp-action` v0.1.7→v1.0.0, `appleboy/ssh-action` v1.0.3→v1.2.5). First post-merge deploy was the live test — all green.                                                                                                                                     |
| #40 | `d526b1c` | docs: infrastructure contracts + first incident postmortem                                       | Capture the five structural rules + recipes + symptom→cause table + incident-log convention. First incident doc covers the 2026-05-11 signature-UI schema-mismatch outage.                                                                                    | 2 new docs (`docs/infrastructure-contracts.md`, `docs/incidents/2026-05-11-signature-ui-schema-mismatch.md`). Pure docs, no behavioral change.                                                                                                                                                                                                                                                                          |
| #41 | `0fa351e` | feat(a11y): wire NEXT_PUBLIC_USERWAY_ACCOUNT_ID through build-args                               | The UserWay widget was pulled in by PR #38 but the account ID wasn't inlined at build time. This PR plumbs it through Dockerfile ARG/ENV + deploy.yml build-args + GH Actions secret. Also adds `cdn.userway.org` to CSP `script-src`/`style-src`/`font-src`. | Widget loads correctly on deploy. Surfaced the Caddyfile inode bug (next row).                                                                                                                                                                                                                                                                                                                                          |
| #42 | `95cf628` | fix(deploy): Caddy reload uses --force-recreate to pick up new Caddyfile inode                   | After PR #41 merged, the new CSP didn't take effect — Docker file-path bind mounts pin to host inodes, scp writes a new inode, the container's mount stays orphaned. SIGUSR1 reload reads the stale file.                                                     | Replaced SIGUSR1 with `docker compose up -d --no-deps --force-recreate caddy`. Next CSP-touching deploy applied immediately. Failure mode added to `docs/infrastructure-contracts.md` §3.                                                                                                                                                                                                                               |
| #43 | `20c17a7` | fix(a11y): hide UserWay's auto-injected button — use footer button only                          | UserWay injects its own floating trigger button which was visually duplicating our intentional footer "نגישות" pill.                                                                                                                                          | CSS-hide on `#userwayAccessibilityIcon` + `#userwayLstIcon` + `.uwy > .uai`. Panel UI deliberately not hidden — it's a sibling of the trigger, not a child.                                                                                                                                                                                                                                                             |
| #44 | `76e1c21` | fix(ticker): breaking-news headlines bounce back instead of looping seamlessly                   | The `.animate-ticker` block was sizing to its parent's width (a flex item), so `translateX(-50%)` resolved to half the visible-container width — not half the content width. The cycle snap was visible as a bounce.                                          | Added `width: max-content`. Math now correct. But exposed a speed problem — see PR #47.                                                                                                                                                                                                                                                                                                                                 |
| #45 | `8d39c8e` | feat(footer): compact category pills instead of a tall vertical list                             | The "الأقسام" footer column was a 6-line vertical stack — visibly the tallest of the 3 footer columns.                                                                                                                                                        | Replaced with flex-wrap pill chips that match the social-icon visual weight in the adjacent column.                                                                                                                                                                                                                                                                                                                     |
| #46 | `d6d3e64` | feat(admin): Cloudflare Analytics GraphQL fetcher for إحصاءات widget                             | The admin Cloudflare panel previously showed only an env-readiness checklist. This PR built the actual fetcher and UI.                                                                                                                                        | Spec said to use `httpRequestsAdaptiveGroups` + a zone tag, but the site is grey-cloud — zone analytics would return zero. Pivoted to `rumPageloadEventsAdaptiveGroups` (Web Analytics RUM dataset), no zone tag required. Schema verified live with prod token before writing code. 4 parallel queries, 5-min cache, returns null on any failure. UI: 4 KPI cards + 2 top-N lists + 14-day trend chart, all in Arabic. |
| #47 | `a6a13d1` | fix(ticker): slow breaking-news animation 10s → 30s and add seam separator                       | After PR #44 fixed the math, the speed was now ~80–150 px/sec (too fast to read). Also: no `◆` separator between the two duplicated copies.                                                                                                                   | Bumped duration to 30s (~30 px/sec — comfortable for reading). Inserted one `aria-hidden ◆` between the two `<TickerRun>` copies for uniform visual cadence at the seam.                                                                                                                                                                                                                                                |
| #48 | `9b65a91` | fix(ci): migration guard accepts .sql migrations under sql/                                      | The CI guard's regex only matched `^src/payload/migrations/.*\.ts$`. Since PR #10 (May 12), the actual runner is `.sql`-based under `migrations/sql/`. Every real migration since then was forced to use `[skip-migration-check]` override.                   | Regex updated to `^src/payload/migrations/(sql/.*\.sql\|[^/]*\.ts)$`. Both `.ts` baselines and `.sql` migrations now accepted.                                                                                                                                                                                                                                                                                          |
| #49 | `bd2b418` | docs: formally defer SMTP wiring to post-launch backlog                                          | Make the SMTP deferral official with the three implementation options (Resend + real domain, Resend sandbox, Gmail SMTP), recommendation (Resend strategic, Gmail pragmatic fallback), re-evaluation triggers.                                                | Updated `docs/post-launch-backlog.md`. No code change.                                                                                                                                                                                                                                                                                                                                                                  |
| #50 | `e435c7f` | feat(ops): upgrade Postgres backup pipeline with tiered retention + tested restore               | Mid-investigation it surfaced that backups had been running since 2026-05-05 — my earlier "no backups" claim was wrong. This PR upgraded the existing pipeline: tiered retention (7+4+3), new layout, verification step, and a tested restore procedure.      | New `scripts/backup-postgres.sh`, `docs/restore-from-backup.md`, `deploy/iram366-backup.logrotate`. Restore verified against a temp DB — row counts matched prod across 6 tables. Found and fixed two bugs during development (see §4).                                                                                                                                                                                 |
| #51 | `32bf9d4` | feat(ops): weekly docker auto-prune cron + logrotate                                             | After today's manual disk cleanup recovered 30 GB, set up an automated weekly cron to keep it from refilling. Image-only prune; build-cache prune deliberately deferred.                                                                                      | New cron line `0 4 * * 0` (Sundays 04:00 UTC). New `deploy/iram366-docker-prune.logrotate` + `deploy/cron-entries.md` (single source of truth for both cron lines).                                                                                                                                                                                                                                                     |

---

## Section 3 — Key decisions made today (the "why")

Each two lines: what was decided, why.

**Defer SMTP past launch.**
Site launches with 1–2 admin users who can keep their passwords in a password manager; the realistic frequency of a password-reset event over the first months is ~zero, and manual recovery via SSH is trivial at this scale. Wiring SMTP before launch would force either DNS work for a real domain or a deliverability tradeoff against using Resend's sandbox sender, neither of which is justified by actual operational need.

**Use UserWay free tier in the footer, not floating.**
The bottom-left corner is occupied by the social-hub FAB and the bottom-right by the chatbot toggle — a third floating action would stack into one of them on phones. UserWay's auto-injected floating button is CSS-hidden, and our intentional in-footer pill calls `window.UserWay.openWidget()` directly so the panel UI still works.

**Keep Sentry at full settings for first 30 days.**
The Business trial gives elevated quotas (and replay) for the first 14 days, auto-downgrading to the free Developer plan ~2026-05-28. Leaving sample rates at 10% server traces / 5% client traces / replay-on-error-only collects enough data to baseline real traffic before tuning down for the 5K-events/month free-tier ceiling.

**Tiered retention (7 daily + 4 weekly + 3 monthly) for backups instead of the old 30-day rolling.**
The old script kept 30 daily files — that's both more files than necessary for week-scale recovery and not far back enough for month-scale recovery. The new 7+4+3 scheme covers all three time horizons with ~14 files total (~14 MB in R2), and tier-promotion (one dump per night, copied into weekly/monthly when the calendar matches) avoids redundant dumps in the same night.

**Fix the Caddyfile inode bind-mount bug with `--force-recreate caddy`, not by mounting the directory.**
Recreating the container is one workflow line; remounting the directory would expose `/opt/iram366/` (including `.env`, deploy artifacts, migration scripts) to the Caddy container, which is a wider attack surface than the fix requires. The 1–2 seconds of additional restart time per CSP-touching deploy is acceptable given they happen <1× per quarter.

**Fix the CI migration guard regex.**
The guard had been rejecting every real `.sql` migration since PR #10 (a month earlier), forcing the override token. That converts the guard from a safety net into a friction point — defeats its purpose. One-line regex fix re-aligns it to the SQL-runner reality.

**Keep `width: max-content` as the ticker fix.**
The bug was that the marquee track's CSS width didn't match its content width, so `translateX(-50%)` resolved wrong. `max-content` is the semantically correct fix ("size to content"); the alternative `display: inline-block` would change baseline alignment and risk other layout surprises. Browser support for `max-content` is universal since 2020.

**Hide UserWay's auto-injected button via CSS, not their "custom trigger" headless mode.**
UserWay supports `window._userway_config = { trigger: '#our-id' }` set BEFORE `widget.js` loads — but doing so in Next 15's RSC layout requires reordering script tags (`async` becomes problematic) and would create a double-fire scenario where both our React `onClick` and UserWay's auto-attached handler call `openWidget()`. CSS-hide is one rule, no race conditions, and survives UserWay SDK updates better than a script-ordering dance.

**Mirror the docker-prune logrotate + cron-entries doc into the repo, not just on the VPS.**
Crontabs aren't auto-synced by the deploy workflow. If the VPS is ever rebuilt, crontab is lost — only the manually-installed lines are visible to the operator. The mirror gives a recoverable record of every scheduled job, and the `deploy/cron-entries.md` doc has an explicit re-install recipe.

---

## Section 4 — Bugs caught and fixed (the "what almost broke")

### 4.1 Caddyfile inode pinning

**Symptom.** PR #41 added `cdn.userway.org` to CSP. After deploy, `curl -sI https://iram366news.com` still showed the old CSP. The host file at `/opt/iram366/Caddyfile` had the new content. `docker compose logs caddy` showed Caddy was happily serving — just from a stale config.

**Root cause.** Docker file-path bind mounts pin to the host inode at mount time. `scp` (the deploy workflow's sync mechanism) replaces a file by writing a fresh inode and unlinking the original; the kernel keeps the original inode alive as long as anything (the container's mount) still references it. The container's `/etc/caddy/Caddyfile` and the host's `/opt/iram366/Caddyfile` were literally different inodes. SIGUSR1 reload re-read the same stale file.

**Fix.** PR #42 — replaced `docker compose kill -s SIGUSR1 caddy` with `docker compose up -d --no-deps --force-recreate caddy`. Recreating re-establishes the bind mount against the current inode.

**Prevention.** New failure-mode row in `docs/infrastructure-contracts.md` §3 with the `stat`-comparison recipe. Bug had existed since PR #38 added the first explicit CSP host but was invisible because the broad `https:` wildcard in `connect-src` covered Sentry redundantly. PR #41 was the first CSP change that mattered — `script-src` has no wildcard.

### 4.2 CI migration guard regex mismatch

**Symptom.** Every PR that added a real `.sql` migration tripped the CI guard with "Schema files changed but no new migration." Authors had to use the `[skip-migration-check]` override token even when they had done the right thing.

**Root cause.** The guard's regex was `^src/payload/migrations/.*\.ts$` — only TypeScript migrations at the root. But since PR #10 (2026-05-12), the runner has been `.sql`-based, reading from `src/payload/migrations/sql/`. Out of sync for ~2 days.

**Fix.** PR #48 — regex updated to `^src/payload/migrations/(sql/.*\.sql|[^/]*\.ts)$`. Accepts both formats; locks down the `.ts` match to root-level only.

**Prevention.** Doc note in `docs/infrastructure-contracts.md` Rule 4 + Section 5 (queued the fix, now marked shipped with back-reference to #48).

### 4.3 Sentry `NEXT_PUBLIC_DSN` missing as build-arg

**Symptom.** PR #38 wired Sentry — DSN in `.env`, DSN in `.env.example`, server-side init working. But the browser bundle shipped with `process.env.NEXT_PUBLIC_SENTRY_DSN === undefined`, silently disabling all client-side error capture.

**Root cause.** Next.js inlines `NEXT_PUBLIC_*` env vars into the client bundle at **build time**, not runtime. The Docker build runs on GitHub Actions far from the production `.env`. Missing piece: Dockerfile `ARG NEXT_PUBLIC_SENTRY_DSN` + `ENV` pair, AND `--build-arg` line in `deploy.yml`, AND the var as a GH Actions secret.

**Fix.** PR #38 commit `e53b3ca` (added the build-arg wiring). Browser SDK now ships with the DSN inlined; events flow on capture.

**Prevention.** Codified as **Rule 1** in `docs/infrastructure-contracts.md` ("Every `NEXT_PUBLIC_*` env var exists in four places"). Section 5 of the same doc queues a future CI check to catch this class of bug at PR time.

### 4.4 UserWay default button visually duplicating ours

**Symptom.** After the UserWay account ID landed in prod (PR #41 deploy), readers saw two accessibility entry points: UserWay's auto-injected floating button (bottom-left, blue circle) AND our intentional footer pill ("نגישות · إمكانية الوصول").

**Root cause.** Misread of UserWay docs in PR #38 — `data-position=8` was described as "docks to footer instead of floating." It actually only controls _where_ the floating button appears, not _whether_. There's no `data-*` to suppress it.

**Fix.** PR #43 — CSS rules on `#userwayAccessibilityIcon` + `#userwayLstIcon` + `.uwy > .uai` hide the trigger only. The panel UI (sibling of the trigger inside `.uwy`) is deliberately untouched.

**Prevention.** None codified. The risk is UserWay renaming the static ID in a future SDK update; the failure mode would be the button reappearing. Detection would be visual; re-fix would be inspecting the bundle for the new selector (recipe in the PR #43 body).

### 4.5 Ticker "bouncing back" animation

**Symptom.** The breaking-news ticker scrolled headlines, then at the end of every cycle visibly snapped back to the start instead of looping continuously.

**Root cause.** `.animate-ticker` was a block-level `<div>` sized to its parent's width. The keyframe used `translateX(-50%)` expecting that to equal one copy of the duplicated headlines, but the track held two copies side-by-side and was wider than the parent. So `-50%` of the element width didn't correspond to one copy's width — the cycle reset to a position that didn't visually match the previous frame.

**Fix.** PR #44 — `width: max-content` on `.animate-ticker` makes the element size to its actual content (two copies). Now `-50%` is exactly one copy's width and the loop is seamless.

**Side-effect:** speed got too fast (~80–150 px/sec) because the corrected math moves a longer distance per 10-second cycle. PR #47 followed up with `animation: ticker-rtl 30s linear infinite` and a `◆` seam separator between the two copies.

**Prevention.** The CSS comment block in `globals.css` now explicitly documents the load-bearing role of `max-content`.

### 4.6 Footer column "too tall"

**Symptom.** The "الأقسام" footer column was a 6-line vertical stack of category links — visibly the tallest of the three footer columns on desktop, made the footer look unbalanced.

**Root cause.** Original design choice — `flex flex-col gap-2` with plain text links.

**Fix.** PR #45 — replaced the column with `flex flex-wrap` pill chips (rounded-full, white-fill, border, hover→gold). Now 1–2 lines tall depending on rendered width.

**Prevention.** N/A — design fix, not a structural bug.

### 4.7 `aws s3 ls --human-readable=false` invalid syntax

**Symptom.** First manual run of the new backup script (PR #50 development) exited non-zero at the verification step with `aws: [ERROR]: An error occurred (ParamValidation): argument --human-readable: ignored explicit argument 'false'`.

**Root cause.** AWS CLI's `--human-readable` is a boolean toggle (or `--no-human-readable` to invert), not a kv pair. I'd written it as `--human-readable=false` thinking it was the standard kv format.

**Fix.** Dropped the flag entirely (default is non-human-readable already). Verified working on second run.

**Prevention.** Caught BEFORE the commit landed because the brief mandated end-to-end test before declaring done.

### 4.8 `psql` multi-statement `-c` transaction wrapping

**Symptom.** During PR #50 restore-verification, `psql -tAc "DROP DATABASE IF EXISTS x; CREATE DATABASE y;"` failed with `ERROR: DROP DATABASE cannot run inside a transaction block`.

**Root cause.** When you pass multiple statements separated by `;` to `psql -c`, psql wraps them in an implicit transaction. `DROP DATABASE` (and several other top-level commands) cannot run inside a transaction. Single-statement `-c` is fine; chained statements break.

**Fix.** Split into two separate `psql -c` invocations. The same bug was present in the early draft of `docs/restore-from-backup.md`'s smoke-test section; also fixed there with an explanatory comment.

**Prevention.** Comment in the restore doc explaining the gotcha so the next operator who copy-pastes from it doesn't hit it.

---

## Section 5 — Operational runbook (the "how to maintain this")

### Daily routine — automated

| Time (UTC)                    | What                                                                                                    | Log file                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 03:00                         | `scripts/backup-postgres.sh` runs nightly Postgres dump → R2 with tier promotion if Sunday/1st-of-month | `/var/log/iram366-backup.log`       |
| 04:00 Sundays                 | `docker image prune -af --filter "until=168h"` cleans up image layers >7 days old                       | `/var/log/iram366-docker-prune.log` |
| Nightly (Ubuntu `cron.daily`) | logrotate runs on both logs above (weekly rotation, keep 4 weeks gzip-compressed)                       | n/a                                 |
| On TLS expiry approach        | Caddy auto-renews TLS via Let's Encrypt                                                                 | Caddy's own log                     |

### Manual cadence

| Frequency     | What                                                                                                        | Why                                                                                                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Monthly**   | `df -h /` on the VPS, eyeball                                                                               | Was 89% on 2026-05-14; now 26%. Should hover under 40% indefinitely with the weekly prune. If creeping past 60%, add the build-cache prune cron line documented in `deploy/cron-entries.md`. |
| **Monthly**   | Spot-check that the latest entry in `s3://iram366-media/postgres/daily/` is from the previous night.        | Paranoia confirmation that cron is firing. One-line check in step 1 of `docs/restore-from-backup.md`.                                                                                        |
| **Quarterly** | Run the full restore procedure into a temp database (smoke-test variant).                                   | Paranoia confirmation that the dumps are restorable. Procedure documented in `docs/restore-from-backup.md` "Smoke-test variant" section.                                                     |
| **Quarterly** | Rotate `PAYLOAD_SECRET`, `PAYLOAD_PREVIEW_SECRET`, `SEED_SECRET`.                                           | Standard secret hygiene. Note that rotating `PAYLOAD_SECRET` invalidates every admin session — coordinate with editorial.                                                                    |
| **Quarterly** | Re-verify R2 access keys; rotate if any laptop has been lost.                                               | R2 keys grant full bucket access (media + backups).                                                                                                                                          |
| **Annually**  | Confirm Caddy TLS renewals are still firing. Watch for Let's Encrypt expiry-warning emails at `ACME_EMAIL`. | Nothing to do unless those emails arrive.                                                                                                                                                    |

### Calendar reminders Faris should set

- **2026-05-28** — Sentry Business trial ends; downgrades to free Developer plan. Check Sentry → Usage Stats to confirm capture continues; tune sample rates if events are bumping the 5K/month cap.
- **🔴 ASAP** — Rotate `CF_ANALYTICS_API_TOKEN` (Cloudflare → Profile → API Tokens → ⋯ → Roll). Token name in CF: `iram366-analytics-read`. Then `docker compose up -d --no-deps --force-recreate app`.
- **[unknown]** — Hostinger VPS billing renewal date. Faris to look up in panel and add to calendar.
- **[unknown]** — `iram366news.com` domain registrar renewal date. Same — confirm where it's registered and the renewal date.

### Deploy procedure

```
gh pr merge <PR#> --merge --delete-branch
# Then watch
gh run watch
# Smoke
curl -s -o /dev/null -w "%{http_code}\n" https://iram366news.com/api/health
```

That's it. The `Build & Deploy` workflow handles: image build → push to GHCR → SCP compose/Caddyfile/scripts to VPS → pull image on VPS → run SQL migrations → recreate app container → recreate caddy (PR #42 made this stable for CSP changes) → smoke-test.

### Rollback procedure

For a code-side regression discovered after deploy:

```
git checkout main
git pull
git revert <bad-merge-commit-SHA> -m 1
git push origin main
```

The push triggers a re-deploy with the bad commit reverted. The migration-aware deploy step is idempotent — applying a revert that includes "no schema change" is safe.

For an environment-side issue (env var, compose file, Caddyfile), edit directly on the VPS first to mitigate, then ensure the fix is mirrored to the repo and deployed so the next push doesn't undo the manual edit. See `docs/infrastructure-contracts.md` Rules 1–3 for the file-by-file mapping.

### Production DB access

```
ssh iram
cd /opt/iram366
set -a; . ./.env; set +a
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

Read-only inspection from there is safe. Any `UPDATE`/`DELETE`/`ALTER` against prod data should pause and ask whether there's a code path that should be doing this instead (Payload's admin, a migration, an API endpoint).

### Restore from backup

Full procedure in `docs/restore-from-backup.md`. Two variants:

- **Catastrophic restore** — overwrites prod. 8 steps. Use only when the data is genuinely gone.
- **Smoke-test variant** — restores into a temp database without touching prod. Use for paranoia checks and as the quarterly verification mentioned above.

---

## Section 6 — Open files outside the repo

**⚠️ One file lives outside this repo and contains operational details that must NOT be committed.** Future-Faris (and any future operator) should know it exists:

**`/home/faris/Documents/iram366-service-providers.md`** (~30 KB)

Contents: comprehensive reference for every external service the project depends on. Per-service: account owner, login URL, account identifier (email/org slug), credential storage locations (path to env var, never the value itself), plan/tier, graceful-degradation behavior, recovery flow. Plus a "What's missing" / "Reminder schedule" / "Outstanding questions" set of operational notes.

**Why it's outside the repo:** the doc references credential storage paths in production `.env`, account-recovery email addresses, third-party account ownership, and credential-rotation expectations. Some of that is private operational knowledge that shouldn't be in a public-readable git history even if technically not a secret.

**Two-layer protection:**

1. The file is at `~/Documents/`, which is outside any git repo on Faris's machine (`git rev-parse --git-dir` from there fatals at the filesystem boundary).
2. The filename is listed in `~/.gitignore_global` (`core.excludesfile` in `~/.gitconfig`) — defense in depth in case the file is ever moved into a repo by accident.

**When to read it:** anytime you're about to touch credentials, rotate something, change a service plan, recover from a vendor outage, or hand operational knowledge to a new operator.

**When to update it:** new vendor onboarded; credential rotated; vendor plan changed; account ownership changed; recovery-flow assumption broken.

---

## Section 7 — Handover prep status

The site is technically launchable today. Three handover artifacts are at different stages:

| Artifact                         | Status                                                                                                                                                   | Where it goes                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **The site itself**              | ✅ Deployed and operational                                                                                                                              | `https://iram366news.com`                                                                                                |
| **Operational documentation**    | ✅ In repo (`docs/infrastructure-contracts.md`, `docs/restore-from-backup.md`, `docs/sentry-setup.md`, `docs/post-launch-backlog.md`, `docs/incidents/`) | For the next developer or future-Faris                                                                                   |
| **Service-providers reference**  | ✅ At `~/Documents/iram366-service-providers.md`                                                                                                         | For Faris's personal operational records                                                                                 |
| **Today's session notes**        | ✅ This document (PR open)                                                                                                                               | For the next session                                                                                                     |
| **Handover PDF for the client**  | ❌ Not built                                                                                                                                             | A separate session — stats gathering brief was prepared earlier but the PDF itself hasn't been built                     |
| **Handover note for the client** | ❌ Not written                                                                                                                                           | One short message summarizing what they can do in `/admin` and what they need to provide (the 5 consolidated TODO items) |
| **Client legal info collection** | ⏳ Pending client response                                                                                                                               | Status of any WhatsApp/email request to the client is not tracked in this repo                                           |

---

## Section 8 — Things to investigate next session

Items I noticed during today's work but didn't act on. None are urgent; all could be one-shot tasks.

1. **Cloudflare token rotation** (🔴 highest priority of this list). The current `CF_ANALYTICS_API_TOKEN` value was exposed in chat. Read-only on analytics so the actual blast radius is small, but leaving an exposed credential live indefinitely is bad operational hygiene. 30-second fix in the Cloudflare dashboard + 30-second VPS env update.

2. **Sentry source-map upload.** Today's Sentry SDK ships without source-map upload configured — stack traces are captured but in minified form. Adding `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` as GH Actions secrets activates the upload via the existing `withSentryConfig` wrapper. Recipe in `docs/sentry-setup.md`. Worth doing before any real-traffic week starts producing real errors.

3. **Smoke-test CSP assertion.** The deploy workflow's smoke test only checks `/ → 200`. It would have passed during the PR #41 deploy that broke UserWay CSP (the page still rendered — just with a stale CSP). Extending the smoke test to grep for specific header tokens after a CSP-touching deploy would catch this class of regression at deploy-time instead of relying on operator vigilance. Discussed in PR #42 body; tracked as informal future work.

4. **`[skip-migration-check]` override token.** Now that the regex is correct (PR #48), the override token is rarely needed. The question: should we leave it as an escape hatch (label-only changes that don't need migrations), or remove it because every legitimate schema change now passes the guard without it? Worth a 5-minute think before next schema-touching PR.

5. **Build-cache prune cron.** Today's manual cleanup found build cache was the bulk of the 30 GB freed. The weekly cron only prunes images, not build cache, as a conservative call. Re-evaluate in 2–4 weeks: if disk is creeping past 60%, add the one-line build-cache prune entry per `deploy/cron-entries.md` "Forward note".

6. **The two pre-PR-#50 backups in `s3://iram366-media/postgres/daily/`.** Both are valid backups (one from a buggy first manual run, one from the clean second run). They'll age out of the 7-day daily window naturally. Could clean up manually with one `aws s3 rm` call if visual tidiness matters; otherwise leave them.

7. **VPS disk monitoring.** No alerting today — only the monthly eyeball check from §5. If you ever want a "page me when disk > 80%" cron, it's a few lines of bash + a webhook (e.g. to Slack or a `wa.me/` URL). Not in scope for any current PR.

8. **Test the restore procedure quarterly.** It was tested once on 2026-05-14 (PR #50 verification). The doc says "quarterly" but there's no calendar reminder set. Faris should add one.

---

## Section 9 — TL;DR for tomorrow morning

The site is live at `https://iram366news.com`, all 14 PRs from today are merged, nightly backups + weekly disk prune are automated, and the four post-launch hardening PRs from the original plan are closed (SMTP formally deferred). **The single most important thing waiting on you tomorrow is the Cloudflare Analytics token rotation** (30-second task — pasted in chat earlier today, read-only scope, but should be rolled). **Everything else is waiting on the client** to supply postal address + ח.פ. + accessibility coordinator + editorial roster + real YouTube/Telegram URLs — none of which a developer can invent, and all of which appear as visible `[TODO:]` markers on the legal pages until the client responds.
