# Restoring Postgres from a Cloudflare R2 backup

This is the operational runbook for restoring `iram366` Postgres from a nightly backup. **It assumes you've already decided that a restore is the correct response** — restoring overwrites every row of every table with the backup's contents. If the problem is "one article was deleted by mistake" the backup-based restore is not the right tool; a row-level recovery from a fresh `pg_dump` against the current DB is. The procedures below are for the catastrophic-data-loss case.

## When this procedure applies

- Postgres data volume corrupted, lost to disk failure, or accidentally removed.
- `docker compose down -v` run by mistake (the `-v` removed the named volume).
- Schema or data state corrupted by a botched migration past the point where `payload_migrations` rollback can recover.
- VPS rebuilt from scratch and only the GHCR image + this repo are recoverable.

## Where the backups live

Bucket: `iram366-media` (the same R2 bucket used for media — backups live under a separate prefix).

| Tier    | Prefix                                 | Retention                   |
| ------- | -------------------------------------- | --------------------------- |
| Daily   | `s3://iram366-media/postgres/daily/`   | Last 7 nightly dumps        |
| Weekly  | `s3://iram366-media/postgres/weekly/`  | Last 4 Sunday dumps         |
| Monthly | `s3://iram366-media/postgres/monthly/` | Last 3 first-of-month dumps |

Filenames: `iram366-YYYY-MM-DD-HHMMSS.sql.gz` (UTC). Lexicographic sort == chronological sort.

> **Legacy:** dumps from before PR #50 also live under `s3://iram366-media/backups/YYYY/MM/DD/` with the old `iram366-YYYYMMDDTHHMMSSZ.sql.gz` naming. They will age out of the 30-day window naturally. You can restore from those too — the file format is the same gzipped pg_dump.

## Step-by-step restore (production VPS)

These steps assume you're SSHed to the VPS as a user that can run `docker compose` against `/opt/iram366`. Substitute the timestamp and tier in the example commands.

### 1. List available backups in your chosen tier

```bash
ssh iram
cd /opt/iram366
set -a; . ./.env; set +a

docker run --rm \
  -e AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  -e AWS_DEFAULT_REGION=auto \
  amazon/aws-cli:latest \
  s3 ls "s3://$R2_BUCKET/postgres/daily/" \
  --endpoint-url "https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"
```

The most recent file at the bottom is the freshest backup. Pick the one whose timestamp predates whatever event caused the data loss.

### 2. Download the chosen backup to the VPS

```bash
BACKUP="iram366-2026-05-14-031500.sql.gz"  # ← replace with the file you picked
mkdir -p /tmp/iram-restore
docker run --rm \
  -v /tmp/iram-restore:/work \
  -e AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  -e AWS_DEFAULT_REGION=auto \
  amazon/aws-cli:latest \
  s3 cp "s3://$R2_BUCKET/postgres/daily/$BACKUP" "/work/$BACKUP" \
  --endpoint-url "https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"

ls -la /tmp/iram-restore/
```

Verify the file exists and the size matches what you saw in step 1.

### 3. Stop the app container (no concurrent writes during restore)

```bash
docker compose stop app
```

Leave the `db`, `caddy`, and `autoheal` containers running. Stopping the app freezes writes; readers will see a 502 from Caddy for the duration of the restore (typically <1 minute).

### 4. Pipe the backup into psql

The dump was created with `--clean --if-exists`, so it begins with `DROP TABLE … IF EXISTS` and `DROP TYPE … IF EXISTS` statements. Piping it into the existing `iram366` database will wipe and recreate every object — no manual drop needed.

```bash
gunzip -c /tmp/iram-restore/$BACKUP \
  | docker compose exec -T db psql \
      -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
      -v ON_ERROR_STOP=1 \
      --single-transaction
```

`--single-transaction` wraps the whole restore in `BEGIN … COMMIT`, so a failure at any point rolls back to the pre-restore state. `ON_ERROR_STOP=1` aborts on the first error rather than logging it and continuing.

If you see `ERROR:` lines fly past, the restore is failing. Don't restart `app` yet — see step 7 (recovery).

### 5. Restart the app

```bash
docker compose start app
```

Wait ~15 seconds, then verify it became healthy:

```bash
docker compose ps app --format '{{.Health}}'
# expect: healthy
```

### 6. Verify counts match expectations

```bash
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -c \
  "SELECT 'articles', COUNT(*) FROM articles
   UNION ALL SELECT 'users', COUNT(*) FROM users
   UNION ALL SELECT 'categories', COUNT(*) FROM categories
   UNION ALL SELECT 'site_settings', COUNT(*) FROM site_settings
   UNION ALL SELECT 'payload_migrations', COUNT(*) FROM payload_migrations
   UNION ALL SELECT 'media', COUNT(*) FROM media;"
```

Compare the row counts against what the backup file is expected to contain. Any count of zero where you expected non-zero means the restore didn't actually populate that table — stop and investigate before considering this complete.

Then smoke the public site:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://iram366news.com/
curl -s -o /dev/null -w "%{http_code}\n" https://iram366news.com/api/health
```

Both should return 200.

### 7. If restore fails midway

`--single-transaction` means a half-applied restore is impossible: either every statement committed or none did. So a failure mid-stream leaves the database **at its pre-restore state**.

Diagnose the failure from the psql output, fix the cause (typical causes: schema version mismatch between the backup and the current Payload image; missing `pgvector` extension on a fresh DB), then re-run step 4.

If the database itself is unreachable (e.g. the `db` container won't start), step 4 obviously can't run. Recover Postgres first: `docker compose logs db` to diagnose, `docker compose up -d db` to restart, only then attempt the restore.

### 8. Clean up the temp file

```bash
rm -rf /tmp/iram-restore
```

## Smoke-test variant — restore into a temp database without touching production

Useful when you want to verify a backup is restorable without actually replacing prod data — for example, before a risky migration, or as part of routine backup health checks.

```bash
# In /opt/iram366 on the VPS, with env sourced.
# DROP DATABASE and CREATE DATABASE must each run in their own psql
# invocation — chaining them with a semicolon inside one `-c` triggers a
# "DROP DATABASE cannot run inside a transaction block" error because
# psql wraps multi-statement -c calls in an implicit transaction.
docker compose exec -T db psql -U "$POSTGRES_USER" \
  -tAc 'DROP DATABASE IF EXISTS iram366_restore_test;'
docker compose exec -T db psql -U "$POSTGRES_USER" \
  -tAc 'CREATE DATABASE iram366_restore_test;'

gunzip -c /tmp/iram-restore/$BACKUP \
  | docker compose exec -T db psql \
      -U "$POSTGRES_USER" -d iram366_restore_test \
      -v ON_ERROR_STOP=1

docker compose exec -T db psql -U "$POSTGRES_USER" -d iram366_restore_test -tA -c \
  "SELECT 'articles', COUNT(*) FROM articles
   UNION ALL SELECT 'users', COUNT(*) FROM users
   UNION ALL SELECT 'categories', COUNT(*) FROM categories;"

# When done, drop the temp database
docker compose exec -T db psql -U "$POSTGRES_USER" -c 'DROP DATABASE iram366_restore_test;'
```

This is the exact procedure that was used to validate the backup pipeline before this doc was committed — see PR #50's verification section for the recorded counts.

## Known limitations

- The dump captures **schema + data**, not the R2 media bucket. Articles' image references will point at R2 URLs that are still valid (R2 isn't restored alongside Postgres), but if any image was deleted from R2 between backup-time and restore-time it stays missing.
- The dump captures the `payload_migrations` tracking table. If the restored backup is older than a migration that's been applied since, restoring an older backup will reset the tracking row — meaning the next deploy will try to re-apply migrations that the schema already reflects. The `IF NOT EXISTS` / `IF EXISTS` guards in our SQL migrations make this idempotent in practice, but it's worth knowing.
- The Sentry RUM beacon token and other `NEXT_PUBLIC_*` env values are NOT in the backup (they live in `/opt/iram366/.env`, not Postgres). Restoring Postgres while having lost `/opt/iram366/.env` requires also restoring the env file from your password manager / wherever you keep the backup of it.
