#!/usr/bin/env bash
# ============================================================================
# IRAM 366 — Run the CLI seed against the production stack.
# Reads ADMIN_PASSWORD from /opt/iram366/.env. Idempotent.
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Missing .env in $(pwd)" >&2
  exit 1
fi

set -a; . ./.env; set +a

if [[ -z "${ADMIN_PASSWORD:-}" ]]; then
  echo "ADMIN_PASSWORD must be set in .env before seeding" >&2
  exit 1
fi

docker compose exec -T -e ADMIN_PASSWORD="$ADMIN_PASSWORD" app npm run seed
