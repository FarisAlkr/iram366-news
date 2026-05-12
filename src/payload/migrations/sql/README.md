# SQL migrations

Raw `.sql` files applied by `scripts/apply-migrations.sh` on every deploy.

This replaces the Payload CLI migration path (`payload migrate`), which doesn't
work in this project due to two stacked loader bugs documented in
[`schema_bootstrap.md`](../../../../../.claude/projects/-home-faris-Desktop-MyWork-IRAM-366-News-Platform/memory/schema_bootstrap.md)
and the PR #7/#9 history. Raw SQL via `psql` sidesteps both classes of issue
and is the standard pattern for production database migrations.

## Filename format

```
YYYYMMDD_HHMMSS_short_description.sql
```

UTC timestamp + a short snake_case description. Matches the timestamp format
used by the existing TS baseline migration (`../20260511_192000_initial_baseline.ts`)
so the two are visually consistent in directory listings.

## Ordering

The runner applies files in **alphabetical order** — which, because of the
`YYYYMMDD_HHMMSS_` prefix, equals chronological order. Don't put numbered
files (`001_`, `002_`) here; the timestamp prefix is the ordering signal.

## Tracking

Each successful migration inserts a row into `payload_migrations` with
`name = <filename without .sql>` and `batch = MAX(batch) + 1`. The runner
reads from the same table to decide what's already been applied.

The TS-baseline row (`20260511_192000_initial_baseline / batch 1`) and the
legacy bootstrap row (`dev / batch -1`) already in `payload_migrations` are
respected by the runner — it won't try to re-apply them.

## Transactions

The runner wraps every file in `BEGIN; \i <file>; INSERT INTO payload_migrations …; COMMIT;`
under `--single-transaction --set ON_ERROR_STOP=1`, so:

- A partial migration cannot leave the database half-applied.
- A failure aborts the runner with non-zero exit, which aborts the deploy
  workflow before the app container swap (same safety net as PR #7's
  sequencing).

Write idempotent SQL where you can (`CREATE TABLE IF NOT EXISTS`,
`ADD COLUMN IF NOT EXISTS`, etc.) so re-running a hand-applied migration is
safe. The tracking row prevents the runner from re-running it anyway, but
idempotence helps when recovering from partial manual fixes.

## Writing a new migration

1. Get the UTC timestamp:
   ```bash
   date -u +%Y%m%d_%H%M%S
   ```
2. Create the file:
   ```bash
   touch src/payload/migrations/sql/<timestamp>_add_widget_count.sql
   ```
3. Write the SQL. Plain PostgreSQL DDL/DML — no Payload, no TypeScript, no
   path aliases.
4. Run locally:
   ```bash
   docker compose up -d db
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/iram366 \
     npm run migrate:sql
   ```
5. Commit. The CI guard in `.github/workflows/ci.yml` sees the new file under
   `src/payload/migrations/` and lets the PR through.
6. On merge, the deploy workflow runs the migration before swapping the app
   container.

## Why the existing TS migration file isn't run

`../20260511_192000_initial_baseline.ts` documents the schema as of the
foundation work but is **not** executed by this runner — the runner only
reads `.sql` files in this directory. The TS file is kept for two reasons:

1. The matching row already exists in `payload_migrations`, so the schema
   it describes is considered applied.
2. It serves as a recoverable bootstrap if the prod DB is ever lost — its
   `up()` body is a working `pg_dump` of the schema.

Future schema changes go in `.sql` files here, not in new `.ts` files.
