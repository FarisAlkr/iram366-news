# Infrastructure contracts and operational patterns

This document captures the structural rules that bind the iram366-news codebase to its deployment infrastructure. Most production bugs in this project's history have come from violating one of these rules. Read this before adding a new environment variable, a new external service, or a new schema field.

The deployment topology is fixed: Next.js + Payload + Postgres + Caddy run as Docker Compose services on a single Hostinger VPS. GitHub Actions builds the runtime image, pushes it to GHCR, SCPs orchestration files + SQL migrations to the VPS, runs migrations, then swaps the app container and reloads Caddy. The Docker Compose file uses an explicit `environment:` allowlist — variables from `.env` are not automatically inherited.

The rules below are written against this exact topology. They assume you understand Compose's allowlist behavior, Next.js's `NEXT_PUBLIC_*` build-time inlining, and the difference between server-side and browser-side env access.

---

## Section 1 — The five golden rules

### Rule 1 — Every `NEXT_PUBLIC_*` env var exists in four places

`NEXT_PUBLIC_*` variables are inlined into the client JS bundle at **build time**, not read at runtime. The build runs inside a Docker stage on GitHub Actions, far away from the production `.env`. Each variable must therefore be plumbed through every layer that the build sees.

**The four locations:**

1. **`.env.example`** — the documented contract. Anyone reading the repo expects every variable they need to set to be listed here with a comment.
2. **`docker-compose.yml` → `services.app.environment:`** — Compose's explicit allowlist. Without an entry, the value from `/opt/iram366/.env` is dropped before reaching the container at runtime.
3. **`Dockerfile`** — paired `ARG NAME` then `ENV NAME=${NAME}` in the **builder** stage. Without `ARG`, Docker silently ignores `--build-arg`. Without `ENV`, the variable isn't visible to `npm run build`.
4. **`.github/workflows/deploy.yml`** — the variable must appear in the `docker/build-push-action` step's `build-args` block AND exist as a GitHub Actions secret (`gh secret set NAME --body "…"`).

**Consequence of skipping a step:** the SDK silently no-ops. The bug looks like "feature works locally, the env var is set on prod, but the browser doesn't see it." Diagnosing it requires viewing the deployed JS bundle and grepping for the value — by the time you do that, it's been broken for hours.

**Worked example.** PR #38 added `@sentry/nextjs` and put `NEXT_PUBLIC_SENTRY_DSN` in `.env.example`, prod `/opt/iram366/.env`, and `docker-compose.yml`. The server-side Sentry init worked. The browser SDK shipped with `process.env.NEXT_PUBLIC_SENTRY_DSN === undefined` because the build-arg was never wired. The fix landed in commit `e53b3ca` ("fix(deploy): wire NEXT_PUBLIC_SENTRY_DSN through build-args so client SDK isn't a no-op") — two lines in `Dockerfile`, one line in `deploy.yml`, one `gh secret set` invocation. Total fix: 5 minutes. Diagnosis: 30 minutes of "why is the bundle empty of Sentry markers."

### Rule 2 — Every server-side env var the app reads exists in two places

Server-side variables are read at runtime via `process.env.NAME` inside `instrumentation.ts`, server components, server actions, API routes, and the Payload config. The Docker Compose `environment:` block is an **explicit allowlist** — adding a key to `/opt/iram366/.env` alone has zero effect on what the running container sees.

**The two locations:**

1. **Production `/opt/iram366/.env` on the VPS** — the actual values.
2. **`docker-compose.yml` → `services.app.environment:`** — the forwarding list. The convention here is `NAME: ${NAME:-}` so missing values default to empty string and the app handles them gracefully.

**Consequence of skipping the Compose entry:** the variable is silently empty inside the container. `process.env.NAME === undefined`. Code that depends on it silently no-ops (best case) or throws (worst case).

**Worked example.** The same PR #38 wrote `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` directly into prod `.env`, restarted the container with `docker compose up -d --no-deps --force-recreate app`, and confirmed via `docker compose exec app env | grep -i sentry`: empty. The compose `environment:` block had no entry for either key. Fix in commit `6973add` ("ops(compose): forward SENTRY_DSN + NEXT_PUBLIC_SENTRY_DSN to app container") added two lines to the allowlist; recreate the container; vars appear.

The same gotcha bit the Cloudflare Analytics API token wire-up later that day — the `.env` was correct but the Compose file's `environment:` block needed `CF_ANALYTICS_API_TOKEN: ${CF_ANALYTICS_API_TOKEN:-}`. In that case the entry already existed from an earlier PR; if it hadn't, same failure mode.

### Rule 3 — Every external service the browser talks to is in Caddy's `connect-src` CSP

The Content-Security-Policy emitted by Caddy is the final word on what the browser is allowed to load and connect to. A new third-party service that requires browser-originated requests (analytics beacons, error monitors, embedded videos, payment widgets, font CDNs) is invisible to readers without the matching CSP directive.

**The location:** `Caddyfile` → `header { Content-Security-Policy "…" }` block. Specifically:

- `script-src` — hosts allowed to serve JS to the page (CDN-loaded scripts, not bundled libraries)
- `connect-src` — hosts the page may `fetch()`/`XHR`/`WebSocket` to (this is where most error monitors and analytics SDKs POST events)
- `img-src`, `style-src`, `font-src` — image/CSS/font origins
- `frame-src` — iframe hosts

**Gotcha worth memorizing.** The current `connect-src` already contains the broad token `https:` — meaning _any_ HTTPS host is allowed at the network layer. This masks Rule-3 violations. A new service that "just works" today may break the moment someone tightens the policy (post-launch hardening will). Add the explicit entry even when `https:` covers you — the explicit entry documents intent and survives the tightening.

**Worked example.** PR #38 commit `dc1a308` (`fix(csp): allow *.ingest.de.sentry.io in connect-src so browser SDK can upload events`) added `https://*.ingest.de.sentry.io` to `connect-src`. The change was strictly redundant — the existing `https:` wildcard already permitted it. It's there as intent documentation and protection against future tightening. The commit message says exactly this.

### Rule 4 — Every schema change has a `.sql` migration in `src/payload/migrations/sql/`

Payload's `push: true` mode is **disabled in production** (see `src/payload.config.ts`: `push: process.env.NODE_ENV !== 'production'`). The production database does not auto-sync with collection/global definitions. A new field, table, or relationship that exists in code but not in Postgres causes every query touching it to throw — and the entire page tree returns 500.

**The convention:**

- Files live under `src/payload/migrations/sql/`
- Naming: `YYYYMMDD_HHMMSS_<short_description>.sql`
- One concern per file; runner applies them in alphabetical (== chronological) order
- Tracking: `payload_migrations.name = <filename without .sql>`
- Wrapped automatically in `BEGIN/COMMIT` under `--single-transaction --set ON_ERROR_STOP=1` by `scripts/apply-migrations.sh`

**CI enforcement:** `.github/workflows/ci.yml` runs a "Check for missing migration on schema changes" job on every PR. If any file under `src/payload/collections/` or `src/payload/globals/` changes, the job requires a corresponding new file in `src/payload/migrations/`. Override token: `[skip-migration-check]` in the PR title, body, or any commit message — intended for label-only or admin-description tweaks that genuinely don't need DB work.

**CI guard match list.** The regex accepts both a `.ts` migration at the migrations root (the historical convention — only the hand-written baseline lives there today) and `.sql` migrations under `sql/` (the format the runner has actually applied since PR #10). The earlier limitation where the guard rejected legitimate `.sql` migrations was fixed in PR #48.

**Worked example.** `src/payload/migrations/sql/20260513_052728_add_social_hub_field.sql` — the migration that added the `social_hub_enabled` column to `site_settings`, paired with the SiteSettings.ts change that introduced the runtime toggle for the social hub. The file header explains exactly what columns are added, why, and what schema convention (Payload nested-group → snake_case prefix) it follows.

### Rule 5 — Every deploy runs migrations before container swap

This is structural — already enforced in `.github/workflows/deploy.yml`. The deploy job ordering is:

1. Build & push image to GHCR
2. SCP compose file + Caddyfile + migration runner + new SQL files to VPS
3. `docker compose pull app` (image now available)
4. **`scripts/apply-migrations.sh`** — applies any pending SQL migrations against the live DB
5. `docker compose up -d --no-deps app` — swap to the new image
6. Caddy SIGUSR1 reload
7. Smoke test

If step 4 exits non-zero, `set -e` aborts the SSH script, the workflow fails, and **step 5 never runs** — the previous app version keeps serving traffic. This is the safety net that lets us deploy schema-changing code without paging anyone if the migration fails.

The script is at `scripts/apply-migrations.sh`. Every migration runs through `docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"` wrapped in a single transaction with `ON_ERROR_STOP=1`, so a failure leaves the DB untouched — no half-applied state, no spurious tracking row.

**Consequence of bypassing this:** the original schema-drift outage (2026-05-11). See `docs/incidents/2026-05-11-signature-ui-schema-mismatch.md`. The fix that introduced this rule was PR #7, refined in PR #10. Don't ad-hoc edit the deploy workflow to skip the migrate step.

---

## Section 2 — Common operations and their patterns

### Adding a new server-side env var

1. Add `NAME=` (with placeholder) to `.env.example` under a categorized section.
2. Add `NAME: ${NAME:-}` to `services.app.environment:` in `docker-compose.yml`.
3. Locally: set `NAME` in `.env`, restart the app.
4. On prod: SSH to VPS, append `NAME=…` to `/opt/iram366/.env`, run `docker compose up -d --no-deps --force-recreate app`. Without `--force-recreate`, the container is reused and the new env is not picked up — Compose does not watch `.env`.
5. Verify: `docker compose exec app env | grep NAME` returns the expected value.

### Adding a new `NEXT_PUBLIC_*` env var

1. Steps 1–4 from above, then:
2. Add `ARG NAME` followed by `ENV NAME=${NAME}` in the **builder** stage of `Dockerfile` (next to the existing `NEXT_PUBLIC_*` block).
3. Add `NAME=${{ secrets.NAME }}` to the `build-args` block in the `docker/build-push-action` step of `.github/workflows/deploy.yml`.
4. `gh secret set NAME --body "value"` to register the GitHub Actions secret.
5. Verify after deploy: `curl -s https://iram366news.com/ | grep -o "<expected token>"` — should appear in the inlined chunks.

### Adding a new external service the browser calls

1. Implement the integration. If it's an SDK, install via npm.
2. Update `Caddyfile` `Content-Security-Policy` header:
   - If it serves JS from a CDN: add the host to `script-src`.
   - If the SDK `fetch()`-es/XHRs/`WebSocket`-s to a host: add to `connect-src`.
   - If it embeds an iframe: add to `frame-src`.
3. Use explicit hostnames, not wildcards. Wildcards like `https://*.foo.com` are acceptable for service families that genuinely use many subdomains (Sentry ingest, Cloudflare).
4. Add a comment above the `Content-Security-Policy` line documenting **why** this host was added — future-you reads the policy line and needs to know which token corresponds to which feature.
5. Document the third-party in `docs/post-launch-backlog.md` (or, post-launch, in `~/Documents/iram366-service-providers.md`) so its credentials, login, and graceful-degradation behavior are recorded.

### Adding a new schema field to a collection or global

1. Add the field to the relevant `src/payload/collections/X.ts` or `src/payload/globals/Y.ts`.
2. Run `docker compose exec db pg_dump --schema-only --table=<table> …` against your local dev DB (or use a one-off psql session) to find the column type Payload would emit. Match Payload's naming convention: nested groups become snake_case prefixes (e.g. `signatureUi.enableCursorInk` → `signature_ui_enable_cursor_ink`).
3. Author a SQL migration: `src/payload/migrations/sql/YYYYMMDD_HHMMSS_short_description.sql`. Use the current UTC timestamp. Wrap the column add in `ALTER TABLE … ADD COLUMN IF NOT EXISTS …` so a re-run is idempotent.
4. Test locally: `npm run migrate:sql` (which runs `bash scripts/apply-migrations.sh`). Verify the new column exists via psql.
5. Open the PR. The CI guard will check that you added a migration file. If you added a `.sql` migration the guard may still complain (see Rule 4 note); use `[skip-migration-check]` in the PR title once you've manually verified.
6. After deploy, the SQL runner applies the migration before the new app container starts.

### Adding a new Payload collection

1. Create `src/payload/collections/NewCollection.ts` with proper Arabic `labels` and per-field `label`s.
2. Register it in `src/payload.config.ts` under `collections: [...]`.
3. Author a SQL migration creating the new table plus any FK indexes Payload would have auto-emitted. Generate the SQL by pointing local dev's `push: true` at a scratch DB and dumping the resulting schema.
4. Access control: add `access` callbacks at the collection level. Default-deny for non-public collections. The `isAdmin`, `isAdminOrEditor`, `isPublic` helpers in `src/payload/access/` are the existing vocabulary.
5. If the collection has files (uploads), it inherits the global `s3Storage` plugin config — point Payload at the same R2 bucket, no extra wiring needed.
6. Update `seed.ts` if the collection should have sample data for fresh dev environments.

---

## Section 3 — Known failure modes and detection

| Symptom                                                                                                                                                                                                                    | Likely cause                                                                                                                                                                                                                                                                                    | Rule violated                                                | First place to look                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sentry shows no client-side events but server errors visible                                                                                                                                                               | `NEXT_PUBLIC_SENTRY_DSN` reaches `.env` and Compose but never gets inlined into the browser bundle at build time                                                                                                                                                                                | Rule 1 (build-arg missing)                                   | `.github/workflows/deploy.yml` build-args block + Dockerfile builder stage                                                                                                                                                                                                                                                                                                                       |
| New env var added to `/opt/iram366/.env` but `process.env.NAME` is `undefined` inside the running container                                                                                                                | Compose's `environment:` allowlist drops anything not explicitly listed                                                                                                                                                                                                                         | Rule 2                                                       | `docker-compose.yml` `services.app.environment:`                                                                                                                                                                                                                                                                                                                                                 |
| New external SDK works locally but its analytics/error POSTs fail in production with `Refused to connect` errors in the browser console                                                                                    | CSP `connect-src` doesn't list the SDK's ingest host. Note: today this is masked by the `https:` wildcard — failure mode appears only after CSP is tightened                                                                                                                                    | Rule 3                                                       | `Caddyfile` `Content-Security-Policy` line                                                                                                                                                                                                                                                                                                                                                       |
| Deploy succeeds; site immediately throws 500 on the page that uses the new field                                                                                                                                           | Schema migration missing or didn't run; column doesn't exist in prod Postgres                                                                                                                                                                                                                   | Rule 4 + Rule 5                                              | `payload_migrations` table on prod, GH Actions log for the "Run database migrations" step                                                                                                                                                                                                                                                                                                        |
| Admin works locally but breaks in production with "column X does not exist" errors                                                                                                                                         | Local `push: true` silently added the column; prod has no matching migration                                                                                                                                                                                                                    | Rule 4                                                       | `src/payload/migrations/sql/` — compare timestamps to last collection/global commits                                                                                                                                                                                                                                                                                                             |
| Build fails with "cannot connect to Postgres" during `next build`                                                                                                                                                          | Page renders Payload queries unguarded; build container has no DB                                                                                                                                                                                                                               | Rule for build-time fault tolerance (lib/queries.ts pattern) | `src/lib/queries.ts` `IS_BUILD` short-circuit + try/catch around `getPayloadClient()`                                                                                                                                                                                                                                                                                                            |
| Container restart shows the new image is running but env vars are stale                                                                                                                                                    | `docker compose up -d` without `--force-recreate` reuses the existing container                                                                                                                                                                                                                 | n/a — operational                                            | Always use `--force-recreate` after `.env` edits                                                                                                                                                                                                                                                                                                                                                 |
| Healthcheck reports unhealthy after deploy and autoheal restarts in a loop                                                                                                                                                 | Healthcheck path touches a slow dependency (Postgres) and the pool is exhausted                                                                                                                                                                                                                 | n/a — incident-derived                                       | `/api/health` must be DB-free; see `src/app/api/health/route.ts`                                                                                                                                                                                                                                                                                                                                 |
| Caddyfile changes (CSP, headers, routes) don't take effect after deploy; the deploy reports success and `/opt/iram366/Caddyfile` on the host shows the new content, but `curl -sI` against the site returns the old header | Docker file-path bind mounts pin to host **inodes**, not paths. `scp` replaces the file by writing a new inode; the container's mount stays pointing at the old, now-orphaned inode. SIGUSR1 reload re-reads the same stale file. Caddy is doing its job correctly — the bug is upstream of it. | n/a — deploy-pipeline                                        | Compare `stat /opt/iram366/Caddyfile` (host) against `docker compose exec caddy stat /etc/caddy/Caddyfile` — different inodes means the mount is stale. Fix: `docker compose up -d --no-deps --force-recreate caddy` (re-establishes the bind mount against the new inode). Permanent fix shipped in PR #42 changing the deploy workflow's Caddy reload step from SIGUSR1 to `--force-recreate`. |

The first four rows above are direct corollaries of the five rules. The bottom four are operational footguns that surfaced during real incidents and are worth memorizing on their own.

Reference: `docs/incidents/2026-05-11-signature-ui-schema-mismatch.md` for the canonical schema-drift outage that motivated Rules 4 and 5.

---

## Section 4 — The incident log convention

Production incidents are documented in `docs/incidents/YYYY-MM-DD-short-name.md`, one file per incident. Required sections:

1. **Symptom** — what users saw (URLs, error messages, timing). Write from the reader's perspective, not the operator's.
2. **Timeline** — UTC timestamps for every meaningful event: detection, initial diagnosis, mitigation attempt(s), root-cause identification, fix deployed, full recovery confirmed.
3. **Root cause** — the structural reason, not the proximate trigger. "PR #X shipped without a migration" is proximate; "production runs `push: false` and the deploy pipeline doesn't enforce migrations" is structural.
4. **How detected** — was it user-reported, monitoring-alerted, smoke-test caught, or noticed mid-development? Detection lag is part of the incident.
5. **The fix** — what specific change resolved the symptom. Reference PRs/commits.
6. **Prevention measure added** — what's now in place to make this class of bug structurally impossible (or at least loudly detectable) in future. CI guard, migration, monitoring alert, code refactor, etc. This is the section that turns one-time pain into permanent infrastructure.

The single existing incident is `2026-05-11-signature-ui-schema-mismatch.md` (created alongside this document). Future incidents follow the same template; copy that file as a starting point.

---

## Section 5 — Future hardening (post-launch backlog)

Items that would let CI catch Rule violations before they become production incidents. None of these block launch; all are good candidates for early post-launch work once we know which patterns of churn the project actually has.

**Compose-env sync check.** A shell-script CI job that diffs the variable names referenced by `process.env.*` in source against the keys listed in `docker-compose.yml` → `services.app.environment:` and fails if any source-referenced server-side var is missing from the Compose allowlist. Roughly 30 lines of grep + jq + comm. Complexity: low. Catches Rule 2 violations at PR time, eliminates the "edit .env on the VPS and wonder why it's empty in the container" debugging session.

**`NEXT_PUBLIC_` coverage check.** Extension of the above. For every `NEXT_PUBLIC_*` var referenced in source, verify that it appears in _all four_ Rule-1 locations: `.env.example`, the `environment:` allowlist, `Dockerfile` `ARG`+`ENV`, and `deploy.yml`'s `build-args` block. Catches Rule 1 violations at PR time. Complexity: low-medium — the `ARG`/`ENV` and `build-args` matching requires parsing the multiline YAML and Dockerfile syntax. Worth doing the moment a second `NEXT_PUBLIC_*` build-arg goes missing.

**CSP external-service sync.** Static-analysis pass that finds outbound HTTPS hosts referenced in code (script-loaded SDKs, `fetch()` URLs, iframe `src`) and cross-references with the Caddyfile `Content-Security-Policy` directive. Flags hosts that are connected to in code but absent from the policy. Complexity: medium — requires AST or careful regex over `<script src=>`, `fetch(`, `XMLHttpRequest`, and `<iframe src=>` patterns plus knowledge of which CSP directive applies to each. Becomes much more valuable the moment we drop the broad `https:` token from `connect-src` — until then, Rule 3 violations are silent.

**~~Migration-guard regex update.~~** ✅ **Shipped in PR #48.** The CI guard in `ci.yml` now accepts both legacy `.ts` migrations at the migrations root and `.sql` migrations under `sql/` — matching the SQL-runner reality since PR #10. The override token (`[skip-migration-check]`) remains as an escape hatch for label-only changes that don't need a real migration.

**Build-time DB-reachability assertion** — currently `lib/queries.ts` and the homepage's category loop guard against build-time DB unreachability with `IS_BUILD` short-circuits + try/catch. A defensive test could fail the build if any new server-side Payload caller is added without that pattern, but the cost of writing the test correctly likely exceeds the cost of catching the rare slip at PR review.

---

## Quick reference — file map

When you need to add something, this is where it lives:

| What you're adding             | Files touched                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Server env var                 | `.env.example`, `docker-compose.yml`, prod `/opt/iram366/.env`                                       |
| `NEXT_PUBLIC_*` env var        | the above + `Dockerfile`, `.github/workflows/deploy.yml`, GitHub Actions secret                      |
| External service browser calls | `Caddyfile`, `docs/post-launch-backlog.md` (or service-providers doc)                                |
| Schema field                   | `src/payload/collections/X.ts` or `globals/Y.ts`, `src/payload/migrations/sql/YYYYMMDD_HHMMSS_x.sql` |
| Payload collection             | the above + `src/payload.config.ts`, optional `src/seed.ts`                                          |
| Incident postmortem            | `docs/incidents/YYYY-MM-DD-name.md`                                                                  |
