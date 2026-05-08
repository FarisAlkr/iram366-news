#!/usr/bin/env bash
# ============================================================================
# IRAM 366 — Postgres backup → Cloudflare R2
#
# Run from a cron entry on the VPS, e.g.:
#   0 3 * * *   /opt/iram366/deploy/backup.sh >> /var/log/iram366-backup.log 2>&1
#
# Required env (typically loaded from /opt/iram366/.env):
#   POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
#   R2_BUCKET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
#
# Behavior:
#   * pg_dump runs inside the postgres container (no host postgres-client needed)
#   * gzip-compresses the dump
#   * uploads to s3://${R2_BUCKET}/backups/YYYY/MM/DD/iram366-<timestamp>.sql.gz
#     using awscli configured for the R2 endpoint
#   * deletes local temp files after upload
#   * keeps 30 days of backups, prunes older ones
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
ENV_FILE="${ENV_FILE:-/opt/iram366/.env}"
if [[ -f "$ENV_FILE" ]]; then
  set -a; . "$ENV_FILE"; set +a
fi

: "${POSTGRES_USER:?env not set}"
: "${POSTGRES_DB:?env not set}"
: "${R2_BUCKET:?env not set}"
: "${R2_ACCOUNT_ID:?env not set}"
: "${R2_ACCESS_KEY_ID:?env not set}"
: "${R2_SECRET_ACCESS_KEY:?env not set}"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DATE_PREFIX="$(date -u +%Y/%m/%d)"
TMPDIR="$(mktemp -d -t "iram366-${TIMESTAMP}.XXXXXX")"
TMPFILE="${TMPDIR}/iram366-${TIMESTAMP}.sql.gz"
KEY="backups/${DATE_PREFIX}/iram366-${TIMESTAMP}.sql.gz"
ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

cleanup() { rm -rf "$TMPDIR"; }
trap cleanup EXIT

echo "[$(date -u +%FT%TZ)] backup start db=${POSTGRES_DB}"

# Dump from inside the running postgres container — avoids version-skew issues
# between host pg_dump and the server.
docker compose exec -T db pg_dump \
  --username="$POSTGRES_USER" \
  --no-owner --no-privileges --clean --if-exists \
  --dbname="$POSTGRES_DB" \
  | gzip -9 > "$TMPFILE"

SIZE_BYTES="$(stat -c%s "$TMPFILE" 2>/dev/null || stat -f%z "$TMPFILE")"
echo "[$(date -u +%FT%TZ)] dump complete bytes=${SIZE_BYTES} key=${KEY}"

# Upload via the dockerized aws-cli image (no host install required —
# the image is already pulled by other tasks in this project).
docker run --rm \
  -v "${TMPDIR}:/work" \
  -e AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  -e AWS_DEFAULT_REGION=auto \
  amazon/aws-cli:latest \
  s3 cp "/work/$(basename "$TMPFILE")" "s3://${R2_BUCKET}/${KEY}" \
    --endpoint-url "$ENDPOINT" \
    --only-show-errors

echo "[$(date -u +%FT%TZ)] upload complete"

# Prune backups older than 30 days.
CUTOFF="$(date -u -d '30 days ago' +%Y-%m-%d 2>/dev/null || date -u -v-30d +%Y-%m-%d)"

OLD_KEYS="$(docker run --rm \
  -e AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  -e AWS_DEFAULT_REGION=auto \
  amazon/aws-cli:latest \
  s3 ls "s3://${R2_BUCKET}/backups/" --recursive --endpoint-url "$ENDPOINT" \
  | awk -v cutoff="$CUTOFF" '$1 < cutoff { print $4 }')"

if [[ -n "$OLD_KEYS" ]]; then
  while IFS= read -r OLD_KEY; do
    [[ -z "$OLD_KEY" ]] && continue
    docker run --rm \
      -e AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
      -e AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
      -e AWS_DEFAULT_REGION=auto \
      amazon/aws-cli:latest \
      s3 rm "s3://${R2_BUCKET}/${OLD_KEY}" \
        --endpoint-url "$ENDPOINT" \
        --only-show-errors
    echo "[$(date -u +%FT%TZ)] pruned ${OLD_KEY}"
  done <<< "$OLD_KEYS"
fi

echo "[$(date -u +%FT%TZ)] backup done"
