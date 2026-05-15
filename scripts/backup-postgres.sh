#!/usr/bin/env bash
# ============================================================================
# IRAM 366 — Postgres backup → Cloudflare R2 (tiered retention)
#
# Runs from a cron entry on the VPS. Replaces the earlier deploy/backup.sh
# which used a simpler 30-day rolling retention. Schema:
#
#   s3://${R2_BUCKET}/postgres/daily/    last 7 nightly dumps
#   s3://${R2_BUCKET}/postgres/weekly/   last 4 Sunday dumps
#   s3://${R2_BUCKET}/postgres/monthly/  last 3 first-of-month dumps
#
# At steady state R2 holds 14 files totalling a few MB. Filenames are
#   iram366-YYYY-MM-DD-HHMMSS.sql.gz
# Sortable lexicographically by date (the prune step relies on this).
#
# A "tier promotion" pattern is used rather than separate dumps per tier:
# every run produces ONE dump that lands in daily/, and on the appropriate
# weekday or day-of-month an S3 server-side copy lifts the same file into
# weekly/ and/or monthly/. This avoids generating multiple identical dumps
# in the same night.
#
# Cron entry (in root's crontab on the VPS):
#   0 3 * * *   /opt/iram366/scripts/backup-postgres.sh >> /var/log/iram366-backup.log 2>&1
#
# Required env (from /opt/iram366/.env):
#   POSTGRES_USER, POSTGRES_DB
#   R2_BUCKET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
#
# The script uses the dockerized amazon/aws-cli:latest image so the VPS host
# doesn't need a system-level AWS CLI install. The image is cached after the
# first run; subsequent runs are fast.
#
# Verification: after upload, an S3 HEAD/list re-fetches the object and
# asserts the byte size is non-zero. If verification fails the script exits
# non-zero — which surfaces in /var/log/iram366-backup.log and (combined with
# a future monitoring layer reading that log) would page on a missed backup.
#
# Restore procedure: docs/restore-from-backup.md.
# ============================================================================
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/iram366/.env}"
COMPOSE_DIR="${COMPOSE_DIR:-/opt/iram366}"
AWS_IMAGE="${AWS_IMAGE:-amazon/aws-cli:latest}"

DAILY_KEEP=7
WEEKLY_KEEP=4
MONTHLY_KEEP=3

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

: "${POSTGRES_USER:?env not set}"
: "${POSTGRES_DB:?env not set}"
: "${R2_BUCKET:?env not set}"
: "${R2_ACCOUNT_ID:?env not set}"
: "${R2_ACCESS_KEY_ID:?env not set}"
: "${R2_SECRET_ACCESS_KEY:?env not set}"

cd "$COMPOSE_DIR"

NOW_UTC="$(date -u +%Y-%m-%d-%H%M%S)"
ISO_NOW="$(date -u +%FT%TZ)"
DOW="$(date -u +%u)"  # 1=Mon … 7=Sun
DOM="$(date -u +%d)"  # 01..31
FNAME="iram366-${NOW_UTC}.sql.gz"
TMPDIR="$(mktemp -d -t "iram366-${NOW_UTC}.XXXXXX")"
TMPFILE="${TMPDIR}/${FNAME}"
ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
DAILY_KEY="postgres/daily/${FNAME}"
WEEKLY_KEY="postgres/weekly/${FNAME}"
MONTHLY_KEY="postgres/monthly/${FNAME}"

log() { echo "[$(date -u +%FT%TZ)] $*"; }

cleanup() { rm -rf "$TMPDIR"; }
trap cleanup EXIT

aws_cli() {
  docker run --rm \
    -e AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
    -e AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
    -e AWS_DEFAULT_REGION=auto \
    "$AWS_IMAGE" "$@" \
    --endpoint-url "$ENDPOINT"
}

# Same call as above but with a volume mount for upload/download.
aws_cli_with_volume() {
  local volume="$1"
  shift
  docker run --rm \
    -v "${volume}:/work" \
    -e AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
    -e AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
    -e AWS_DEFAULT_REGION=auto \
    "$AWS_IMAGE" "$@" \
    --endpoint-url "$ENDPOINT"
}

log "backup start db=${POSTGRES_DB} timestamp=${NOW_UTC}"

# ---- 1. Dump (in-container pg_dump avoids host/server version skew) ---------
# `set -o pipefail` is on, but it only catches failures that bubble up to
# the LAST command in the pipeline. A pg_dump that crashes mid-stream
# after writing some bytes still produces a "valid" gzip of a truncated
# dump — gzip exits 0, the size check passes, and the corrupted file
# uploads, eventually displacing the last known-good copy in the 7-day
# rolling window. PIPESTATUS catches the pg_dump exit code explicitly.
docker compose exec -T db pg_dump \
  --username="$POSTGRES_USER" \
  --no-owner --no-privileges --clean --if-exists \
  --dbname="$POSTGRES_DB" \
  | gzip -9 >"$TMPFILE"
PG_DUMP_RC="${PIPESTATUS[0]}"
GZIP_RC="${PIPESTATUS[1]}"
if [[ "$PG_DUMP_RC" != "0" || "$GZIP_RC" != "0" ]]; then
  log "ERROR: dump pipeline failed pg_dump_rc=${PG_DUMP_RC} gzip_rc=${GZIP_RC}; aborting" >&2
  exit 1
fi

LOCAL_SIZE="$(stat -c%s "$TMPFILE" 2>/dev/null || stat -f%z "$TMPFILE")"
log "dump complete local_bytes=${LOCAL_SIZE} file=${FNAME}"
if [[ "$LOCAL_SIZE" -lt 1024 ]]; then
  log "ERROR: dump suspiciously small (<1KB); aborting before upload" >&2
  exit 1
fi

# Gzip integrity check before upload. `gzip -t` verifies the CRC and that
# the file decompresses cleanly without actually writing the output. This
# catches truncation inside the gzip layer that PIPESTATUS missed (e.g.
# disk full halfway through, kernel OOM-killing one of the pipe halves).
if ! gzip -t "$TMPFILE" 2>/dev/null; then
  log "ERROR: dump fails gzip integrity check; aborting before upload" >&2
  exit 1
fi
log "gzip integrity verified"

# ---- 2. Upload to daily/ ----------------------------------------------------
aws_cli_with_volume "$TMPDIR" s3 cp "/work/${FNAME}" "s3://${R2_BUCKET}/${DAILY_KEY}" \
  --only-show-errors
log "uploaded ${DAILY_KEY}"

# ---- 3. Verify upload (size > 0 round-trip via aws s3 ls) -------------------
# aws s3 ls returns: "<date> <time> <size> <key-tail>". Parse field 3.
REMOTE_SIZE="$(aws_cli s3 ls "s3://${R2_BUCKET}/${DAILY_KEY}" \
  | awk 'NR==1 { print $3 }')"

if [[ -z "$REMOTE_SIZE" || "$REMOTE_SIZE" -lt 1024 ]]; then
  log "ERROR: upload verification failed remote_size='${REMOTE_SIZE}' key=${DAILY_KEY}" >&2
  exit 1
fi
log "verified daily remote_bytes=${REMOTE_SIZE}"

# ---- 4. Promote into weekly/ on Sundays (DOW=7) and monthly/ on day 01 ------
if [[ "$DOW" == "7" ]]; then
  aws_cli s3 cp "s3://${R2_BUCKET}/${DAILY_KEY}" "s3://${R2_BUCKET}/${WEEKLY_KEY}" \
    --only-show-errors
  log "promoted to weekly ${WEEKLY_KEY}"
fi

if [[ "$DOM" == "01" ]]; then
  aws_cli s3 cp "s3://${R2_BUCKET}/${DAILY_KEY}" "s3://${R2_BUCKET}/${MONTHLY_KEY}" \
    --only-show-errors
  log "promoted to monthly ${MONTHLY_KEY}"
fi

# ---- 5. Prune older entries per tier ----------------------------------------
prune_tier() {
  local prefix="$1"
  local keep="$2"

  # aws s3 ls "prefix/" lists "<date> <time> <size> <filename>" lines.
  # We only need the filename column. Sort descending (most recent first;
  # filenames begin with the UTC timestamp so lexicographic == chronological),
  # skip the first $keep entries, delete the rest.
  local victims
  victims="$(aws_cli s3 ls "s3://${R2_BUCKET}/${prefix}" \
    | awk '{print $4}' \
    | grep -E '^iram366-' \
    | sort -r \
    | tail -n +$((keep + 1)) \
    || true)"

  if [[ -z "$victims" ]]; then
    log "prune ${prefix} no candidates (keep=${keep})"
    return
  fi

  while IFS= read -r name; do
    [[ -z "$name" ]] && continue
    aws_cli s3 rm "s3://${R2_BUCKET}/${prefix}${name}" --only-show-errors
    log "pruned ${prefix}${name}"
  done <<<"$victims"
}

prune_tier "postgres/daily/" "$DAILY_KEEP"
prune_tier "postgres/weekly/" "$WEEKLY_KEEP"
prune_tier "postgres/monthly/" "$MONTHLY_KEEP"

log "backup done"
