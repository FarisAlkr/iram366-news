#!/usr/bin/env bash
# ============================================================================
# IRAM 366 — Deploy/Update Script
# Sync source to the VPS and rebuild the docker stack.
# Usage: ./deploy/deploy.sh user@VPS_IP
# ============================================================================
set -euo pipefail

if [[ -z "${1:-}" ]]; then
  echo "Usage: ./deploy/deploy.sh user@VPS_IP" >&2
  exit 1
fi

VPS="$1"
REMOTE_DIR="${REMOTE_DIR:-/opt/iram366}"

echo "============================================="
echo " IRAM 366 — Deploying to $VPS"
echo "============================================="

echo ">>> Syncing files to VPS..."
rsync -avz --delete --progress \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.env' \
  --exclude '.git' \
  --exclude 'tsconfig.tsbuildinfo' \
  --exclude 'coverage' \
  ./ "$VPS:$REMOTE_DIR/"

echo ">>> Building and starting containers on VPS..."
ssh "$VPS" "cd $REMOTE_DIR && docker compose pull --ignore-pull-failures && docker compose up -d --build"

# Schema sync: payload.config.ts uses `push: true`, which mirrors the
# code-defined collections to the database on app boot. We do NOT run
# `payload migrate` here because:
#   1. The production image doesn't ship the payload CLI in PATH
#      (`sh: payload: not found`), and previously this step was suffixed
#      with `|| true`, hiding every failure.
#   2. With `push: true`, an explicit migrate step would be a no-op or
#      conflict.
# When the project moves off `push: true` (i.e. uses migration files),
# add `payload migrate` back here WITHOUT `|| true` so failures fail
# the deploy loudly. See deploy/RUNBOOK.md for the migration cutover.

echo ">>> Service status:"
ssh "$VPS" "cd $REMOTE_DIR && docker compose ps"

echo ""
echo "============================================="
echo " Deploy complete"
echo "============================================="
