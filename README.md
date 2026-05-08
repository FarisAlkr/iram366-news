# IRAM 366 — Arabic News Platform

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![Payload CMS](https://img.shields.io/badge/Payload-3.x-2563eb)](https://payloadcms.com)
[![PostgreSQL](https://img.shields.io/badge/Postgres-16-336791)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](https://www.typescriptlang.org/)

> إرم 366 الإخبارية — منصة إخبارية مستقلة، RTL native، تغطي رهط والنقب.

A production-grade newsroom platform: a public Arabic news site and an embedded
admin dashboard, served from a single Next.js + Payload CMS process. RTL is
native, not flipped; typography, security headers, ISR, image pipeline, and
deployment are all set up for a real publication on day one.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Visitors (mobile/desktop)                      │
└─────────────────────────────────────────────────────────────────────────┘
                                   │ HTTPS
                                   ▼
                        ┌──────────────────────┐
                        │  Caddy (auto-TLS,    │
                        │  HSTS, CSP, gzip)    │
                        └──────────┬───────────┘
                                   │ reverse_proxy
                                   ▼
        ┌──────────────────────────────────────────────────────┐
        │             Next.js 15 (standalone server)           │
        │  ┌────────────────────────┬──────────────────────┐   │
        │  │ Public site (RSC, ISR) │ Admin /admin (Payload│   │
        │  │  app/(frontend)/...    │  CMS UI)             │   │
        │  └────────────────────────┴──────────────────────┘   │
        │  Custom API: /api/articles/[slug]/view, /api/search, │
        │  /api/feed/rss, /api/seed (gated)                    │
        └──────────────┬─────────────────────────┬─────────────┘
                       │                         │
                       ▼                         ▼
            ┌──────────────────┐       ┌───────────────────────┐
            │  PostgreSQL 16   │       │  Cloudflare R2        │
            │  (Payload schema)│       │  (image storage)      │
            └──────────────────┘       └───────────────────────┘
```

### Tech Stack

| Layer            | Choice                                            |
| ---------------- | ------------------------------------------------- |
| Framework        | Next.js 15.4 (App Router, Server Components)      |
| CMS              | Payload CMS 3.x (embedded in Next.js)             |
| Database         | PostgreSQL 16 (`@payloadcms/db-postgres`)         |
| Media storage    | Cloudflare R2 (`@payloadcms/storage-s3`)          |
| Editor           | Lexical (`@payloadcms/richtext-lexical`)          |
| Styling          | Tailwind CSS 3 (RTL-native, logical properties)   |
| Reverse proxy    | Caddy 2 (auto-HTTPS, security headers)            |
| Container        | Docker (multi-stage, standalone Next output)      |
| Orchestration    | Docker Compose (3 services: db / app / caddy)     |
| Logger           | Custom structured JSON logger                     |
| Tests            | Vitest + happy-dom                                |
| Lint / Format    | ESLint + Prettier                                 |

### Project layout

```
src/
├── app/
│   ├── (frontend)/          # public site
│   ├── (payload)/           # /admin + Payload REST API
│   └── api/                 # custom routes (view, search, rss, seed)
├── components/              # shared UI components
├── domain/enums.ts          # ArticleStatus, UserRole, AuditAction, HeroMode
├── lib/
│   ├── logger.ts            # JSON logger
│   ├── rate-limit.ts        # token-bucket
│   ├── queries.ts           # cached read-side data access
│   ├── slug.ts              # slug + Arabic normalization
│   ├── date.ts              # Arabic-locale date helpers
│   └── payload.ts           # Payload local client
├── payload/
│   ├── access/              # role-based access helpers
│   ├── collections/         # data models
│   ├── globals/             # SiteSettings
│   ├── hooks/audit.ts       # audit log factory
│   └── migrations/          # SQL migrations (run with npm run migrate)
├── types/payload.ts         # populated wrapper types over Payload responses
└── seed.ts                  # CLI seed
```

---

## Quickstart (local dev)

```bash
# 1. Clone, install
npm install

# 2. Copy env template, fill values
cp .env.example .env
# (generate secrets with: openssl rand -hex 32)

# 3. Start Postgres only (or run full stack)
docker compose up -d db

# 4. Run dev server (uses push: true for schema sync in dev)
npm run dev

# 5. Seed the database (admin user, categories, sample articles)
ADMIN_PASSWORD=changeme npm run seed

# 6. Open http://localhost:3000 (public site) or /admin (CMS)
```

### Common scripts

| Command                    | What it does                              |
| -------------------------- | ----------------------------------------- |
| `npm run dev`              | Next.js dev server                        |
| `npm run build`            | Production build (standalone output)      |
| `npm run start`            | Run production server (after build)       |
| `npm run lint`             | ESLint with `--max-warnings 0`            |
| `npm run lint:fix`         | Autofix lint issues                       |
| `npm run format`           | Prettier write                            |
| `npm run typecheck`        | `tsc --noEmit`                            |
| `npm test`                 | Run unit tests (vitest)                   |
| `npm run migrate`          | Apply Payload SQL migrations              |
| `npm run migrate:create`   | Generate a new migration from schema diff |
| `npm run migrate:status`   | List applied/pending migrations           |
| `npm run seed`             | CLI seed (admin + categories + samples)   |

---

## Deployment

See [`deploy/RUNBOOK.md`](deploy/RUNBOOK.md) for the full operational guide.
TL;DR for a fresh VPS:

```bash
# On a fresh Ubuntu 24.04 VPS:
ssh ubuntu@VPS_IP 'bash -s' < deploy/setup-vps.sh

# Locally, sync code + start the stack:
./deploy/deploy.sh ubuntu@VPS_IP

# On the VPS, edit /opt/iram366/.env, then:
./deploy/seed-production.sh
```

Backups run nightly at 03:15 UTC via cron, dumping Postgres → Cloudflare R2 with
30-day retention. See `deploy/backup.sh`.

---

## Security

| Concern                | Mitigation                                                             |
| ---------------------- | ---------------------------------------------------------------------- |
| Brute force / DoS      | Token-bucket rate limiter on `/api/search`, view counter, RSS, seed    |
| XSS                    | React escapes by default; JSON-LD only for structured data             |
| SQL injection          | Payload ORM (parameterized); no raw SQL in app code                    |
| CSRF                   | Payload-managed tokens                                                 |
| HTTPS                  | Caddy auto-TLS + HSTS preload                                          |
| Clickjacking           | `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'`                 |
| MIME sniffing          | `X-Content-Type-Options: nosniff`                                      |
| Privilege escalation   | Author role cannot publish (downgraded to in-review by hook)           |
| Single-admin guarantee | Payload hook + Postgres partial unique index (`users_single_admin`)    |
| Audit trail            | Every CRUD operation logged to `audit-log` (admin-read-only)           |
| Seed endpoint          | Gated behind `SEED_SECRET` + production opt-in                         |
| Secrets                | `.env` is gitignored; `.env.example` documents every key               |
| Admin password         | bcrypt via Payload auth                                                |

---

## Roles & permissions

| Role     | Articles                                              | Users      | Site settings | Audit log |
| -------- | ----------------------------------------------------- | ---------- | ------------- | --------- |
| Admin    | Full CRUD on all                                      | Full CRUD  | Update        | Read      |
| Editor   | Create + publish + edit any                           | Update     | Read only     | —         |
| Author   | Create drafts only; edit own; cannot self-publish     | Read names | Read only     | —         |
| Public   | Read published                                        | Read names | Read only     | —         |

---

## Performance

- **ISR:** homepage 60s, article 120s, category 60s, search dynamic
- **Static caching:** `_next/static/*` immutable for 1y, `_next/image/*` 1d
- **Image pipeline:** Sharp generates 4 sizes (thumbnail / card / hero / full) on upload
- **Per-render dedup:** `getSiteSettings()`, `getCategories()` use React `cache()`
- **Cross-request cache:** `getCategories()` wrapped in `unstable_cache` with tag-based invalidation
- **Standalone build:** Docker runtime image only ships the compiled server, ~250MB

---

## What's intentionally not in this repo

- A staging environment compose file — adapt `docker-compose.yml` with a different domain.
- Sentry / DataDog wiring — pluggable via the `logger` module if/when you choose a provider.
- CI/CD config — works with any runner. Add `.github/workflows/ci.yml` to run `npm run typecheck && npm run lint && npm test`.

---

## Documentation

- [`deploy/RUNBOOK.md`](deploy/RUNBOOK.md) — operational guide (deploy, backup, restore, troubleshooting)
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — code style, commit conventions, review checklist
- [`iram366-claude-code-guide.md`](../iram366-claude-code-guide.md) — original design brief
