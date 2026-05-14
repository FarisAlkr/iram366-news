# 2026-05-11 — Signature UI shipped without a matching schema migration

## Symptom

Immediately after PR #6 (`feat: signature UI v2 (calligraphy cursor + footer camel)`) merged at 18:55 UTC, **every page on iram366news.com returned HTTP 500.** The error originated from `getSiteSettings()`, which queries the `site_settings` global. Every public page (homepage, article pages, category pages, search) reads that global through the frontend layout, so the failure was site-wide — no graceful degradation, no partial render. Visitors hitting any URL saw an empty 500 response.

The 500s appeared the moment the deploy workflow's smoke-test step passed and the new app container started serving traffic.

## Timeline

| UTC time         | Event                                                                                                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-05-11 18:55 | PR #6 merged to `main`. Build & Deploy workflow triggered.                                                                                                                                                                                 |
| ~18:58           | New app image built and pushed to GHCR.                                                                                                                                                                                                    |
| ~19:00           | App container swapped to the new image on the VPS. Caddy continued reverse-proxying to the new container. Smoke-test step of the deploy workflow passed (it only verified `/api/health`, which doesn't query Payload).                     |
| ~19:00           | Public pages began returning 500. Detection was immediate — the operator was watching the deploy and reloaded the homepage.                                                                                                                |
| 19:00–19:11      | Diagnosis: `docker compose logs app` showed Payload throwing `column "site_settings.signature_ui_enable_cursor_ink" does not exist`. The new `signatureUi` group on `SiteSettings.ts` had no corresponding columns in production Postgres. |
| 19:11            | Revert PR #6 merged via `git revert`. Deploy workflow triggered.                                                                                                                                                                           |
| ~19:14           | App container swapped back to the prior image. `/` returned 200. Recovery confirmed.                                                                                                                                                       |
| 2026-05-11 20:46 | PR #7 (`fix: migration foundation`) merged — introduced the migration baseline, the CI guard against shipping schema changes without migration files, and flipped `push: false` for production.                                            |
| 2026-05-12 12:35 | PR #10 (`feat: SQL-based migration runner (replaces Payload CLI)`) merged — replaced the broken Payload-CLI migrator approach with a raw-SQL runner under `scripts/apply-migrations.sh`.                                                   |
| 2026-05-12 15:51 | Commit `0e8bcf2` (`feat(db): add signatureUi columns to site_settings`) — the SQL migration that the original PR #6 should have shipped. Applied via the new runner on the deploy that followed.                                           |
| 2026-05-13       | PR #11 (`feat: signature-touches-v3`) merged — re-shipped the calligraphy cursor and footer camel, this time built on the migration foundation. Successful.                                                                                |

Total user-visible outage: ~14 minutes.

## Root cause

**Structural:** the production runtime had no enforced way to bring the database schema forward in lockstep with code. `src/payload.config.ts` was set to `push: true` (Payload's option for auto-syncing schema from code). In the development environment, this worked — `payload dev` runs the same Payload binary that has access to the CLI and the introspection logic, so the schema stayed in sync with collection/global definitions. In production, however, the multi-stage Docker build emits a `runner` image that contains only the standalone Next.js server — no Payload CLI, no introspection logic. `push: true` was set but had no mechanism by which it could actually run against the production database. The schema therefore had to be hand-applied via psql for every collection or global change, and PR #6 added the `signatureUi` group fields without anyone noticing the missing schema work.

**Proximate:** PR #6 was a UI-only PR by intent — calligraphy cursor + footer camel — but it required a single Payload `group` field on `SiteSettings` for the admin runtime-toggle layer to talk to. The author (and reviewer) treated the field addition as "just a UI toggle" and didn't notice it introduced a schema dependency. There was no CI gate to catch this, and the smoke-test step in the deploy workflow only checked `/api/health`, which doesn't touch the site_settings global.

## How detected

Operator was watching the deploy in real time. The site_settings query is on the critical render path for every public route, so the failure was instant and globally observable; the homepage went from 200 to 500 within seconds of the container swap. If the operator had not been watching, detection would have been via the next page view by a human visitor — at the project's then-traffic level, that could have been hours.

This is the incident that motivated `/api/health` to deliberately NOT touch Postgres. Earlier the healthcheck pinged `/api/users` (a Payload route), which queried Postgres. The current `/api/health` (since the next operational PR) is liveness-only — it answers "is this Node process responsive at the HTTP layer," not "is the database happy." A health check that touches the DB pool can hang along with the rest of the app when the pool is exhausted, which is the same failure shape that caused the 2026-05-10 outage one day earlier (separate incident).

## The fix

Three sequenced PRs:

1. **PR #6 revert** — `git revert` of the merge, then deploy. Immediate user-facing recovery.
2. **PR #7** — `fix: migration foundation (baseline + auto-apply + CI guard)`. Established:
   - A hand-written Payload v3 baseline migration capturing the entire production schema at that moment (31 tables, 17 enum types, 142 indexes, the pgvector extension). Pre-marked as applied in `payload_migrations` so future runs skip it.
   - A `migrator` Docker stage carrying the Payload CLI and a corresponding compose service with `profiles: [migrate]`, runnable from CI.
   - `payload.config.ts` flipped to `push: process.env.NODE_ENV !== 'production'` — production must use the migration pipeline; dev keeps the convenience of auto-sync.
   - Deploy workflow split into `Pull new images` → `Run migrations` → `Restart app & reload Caddy`. A migration failure aborts the workflow under `set -e` before the container swap, so the prior schema-compatible app keeps serving.
   - CI guard `Check for missing migration on schema changes` — fails any PR that modifies `src/payload/collections/` or `src/payload/globals/` without adding a new file under `src/payload/migrations/`. Override token `[skip-migration-check]` for label/description-only changes.
3. **PR #10** — `feat: SQL-based migration runner (replaces Payload CLI)`. The CLI-based migrator from PR #7 failed at runtime: Node's native ESM resolver doesn't know about TypeScript path aliases (`@/lib`, `@/components`, …), and the Payload config transitively imports files that use them. PR #10 replaced the CLI approach with `scripts/apply-migrations.sh` — a 99-line bash runner that reads `payload_migrations.name`, finds pending `.sql` files under `src/payload/migrations/sql/`, applies them via `docker compose exec db psql` wrapped in a single transaction with `ON_ERROR_STOP=1`. Reliable, no transpiler/loader involved.

After PR #10 the foundation was production-ready. The signature UI re-ship (PR #11 on 2026-05-13) was the first real exercise of the end-to-end pipeline: SQL migration applied cleanly, container swap succeeded, all features worked.

## Prevention measures added

- **CI guard against schema-change-without-migration** (PR #7). Catches the exact failure mode at PR time.
- **Migration ordering enforced in `deploy.yml`** (PR #7, refined PR #10). Migration step runs between image pull and container swap; failure aborts before swap, prior version keeps serving.
- **`push: false` in production** (PR #7). The migration pipeline is the sole authority for schema in production. Removes the option of "just edit `.env` to flip push back on" — that's no longer enough; you'd have to ship the CLI in the runtime image.
- **`/api/health` is DB-free** (separate operational PR). Healthcheck cannot hang on a slow DB; can't mask DB-related failures by appearing green.
- **Documentation: this file plus `docs/infrastructure-contracts.md` Rules 4 and 5**. The class of bug is now described in writing so a future operator can recognize the shape.

## Lessons that survived into the contracts doc

- **"Just a UI toggle" is not a safe abstraction.** Any Payload `group`, `relationship`, `select`, `array`, or new field requires a schema migration. The CI guard now enforces this.
- **Smoke-test scope matters.** Checking `/api/health` proves the Node process is up; it does NOT prove that any DB-backed page actually renders. Worth keeping the healthcheck DB-free for liveness reasons, but consider adding a second deploy-time check that hits one DB-backed page before declaring success.
- **Auto-sync (`push: true`) in production is a footgun.** It either works silently (and creates schema drift you don't notice) or doesn't work silently (and ships broken code). The migration pipeline is more verbose but legibly fails when something's wrong.

## Open questions / follow-ups not closed by this incident's fixes

- The CI guard regex still looks for `.ts` migration files under `src/payload/migrations/` while the actual runner is `.sql`-based. PRs that add real `.sql` migrations under `sql/` trip the guard and require `[skip-migration-check]`. Listed in `docs/infrastructure-contracts.md` Section 5 as a future hardening item.
- No post-deploy synthetic that exercises a known-DB-backed page (e.g. `/` itself). A 30-second cooldown + `curl https://iram366news.com/ | grep <expected-content>` step would catch this class of failure at deploy time instead of relying on operator vigilance.
