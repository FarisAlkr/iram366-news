#!/usr/bin/env bash
# Applies pending SQL migrations from src/payload/migrations/sql/.
#
# Each migration is wrapped in BEGIN/COMMIT with --single-transaction
# and ON_ERROR_STOP=1, so a failure rolls back cleanly and exits the
# script non-zero. That non-zero exit aborts the deploy workflow before
# the app container swap (same safety net the PR #7 sequencing provided).
#
# Tracking: payload_migrations.name = migration filename without .sql.
# Compatible with the existing TS-baseline rows already in that table
# (`dev / -1` legacy bootstrap, `20260511_192000_initial_baseline / 1`).
#
# psql runs inside the `db` compose service rather than on the host,
# because:
#   (a) the VPS host doesn't ship psql, and
#   (b) the production DATABASE_URL points at `@db:5432`, only reachable
#       inside the compose network.
# Calls go through `docker compose exec -T db psql …` and read user/db
# from the same .env that Docker Compose itself uses.
set -euo pipefail

# Load .env if present. Matches Docker Compose's own .env handling, so
# callers don't have to source it manually and the deploy workflow doesn't
# need a separate env-loading step.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${POSTGRES_USER:?POSTGRES_USER must be set (via .env or environment)}"
: "${POSTGRES_DB:?POSTGRES_DB must be set (via .env or environment)}"

SQL_DIR="${SQL_DIR:-src/payload/migrations/sql}"

if [ ! -d "$SQL_DIR" ]; then
  echo "Migration directory not found: $SQL_DIR" >&2
  exit 1
fi

# Helper: run psql inside the db container with the env-supplied creds.
psql_exec() {
  docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
}

# Ensure the tracking table exists. Idempotent — on prod this is a no-op
# (Payload already created the table); on a freshly bootstrapped dev DB
# it creates the same shape Payload would. Matches the columns observed
# in prod (id serial, name varchar, batch numeric, timestamps with tz).
psql_exec --set ON_ERROR_STOP=1 -tA >/dev/null <<'BOOTSTRAP_SQL'
CREATE TABLE IF NOT EXISTS payload_migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR,
  batch NUMERIC,
  updated_at TIMESTAMP(3) WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP(3) WITH TIME ZONE DEFAULT NOW() NOT NULL
);
BOOTSTRAP_SQL

# Already-applied migration names.
APPLIED=$(psql_exec -tAc "SELECT name FROM payload_migrations" | sort -u)

PENDING=()
for f in "$SQL_DIR"/*.sql; do
  [ -e "$f" ] || continue # empty directory glob expands literally
  name=$(basename "$f" .sql)
  if ! echo "$APPLIED" | grep -qxF "$name"; then
    PENDING+=("$f")
  fi
done

if [ ${#PENDING[@]} -eq 0 ]; then
  echo "No pending migrations."
  exit 0
fi

echo "Applying ${#PENDING[@]} pending migration(s):"
for f in "${PENDING[@]}"; do
  name=$(basename "$f" .sql)
  # Escape single quotes in the name for the SQL literal. Filenames per
  # convention don't contain quotes, but failing safely is cheap.
  name_escaped=${name//\'/\'\'}
  echo "  → $name"
  # Stream BEGIN + the migration body + the tracking INSERT + COMMIT into
  # one psql invocation. `cat` is byte-perfect, so quotes/$/backticks
  # inside the migration file pass through unmolested (a heredoc with
  # `$(cat …)` would shell-expand the file contents — avoided here).
  {
    echo "BEGIN;"
    cat "$f"
    echo
    printf "INSERT INTO payload_migrations (name, batch) VALUES ('%s', (SELECT COALESCE(MAX(batch), 0) + 1 FROM payload_migrations));\n" "$name_escaped"
    echo "COMMIT;"
  } | psql_exec --single-transaction --set ON_ERROR_STOP=1
  echo "    ✓ $name applied"
done

echo "All migrations applied successfully."
