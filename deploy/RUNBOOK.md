# Operations Runbook — IRAM 366

This is the canonical playbook for running the platform in production.

## 1. Initial VPS bootstrap

Tested on Ubuntu 24.04 (Oracle Cloud ARM, Hetzner CX22, DigitalOcean basic).

```bash
ssh ubuntu@VPS_IP 'bash -s' < deploy/setup-vps.sh
```

The script installs Docker + Compose, opens ports 80/443 (Oracle's iptables
needs explicit ACCEPT rules), enables fail2ban + unattended-upgrades, installs
awscli for R2 backups, creates `/opt/iram366`, and registers the nightly
backup cron at 03:15 UTC.

**Log out and back in** so your user picks up the `docker` group.

## 2. First deploy

```bash
# Locally:
./deploy/deploy.sh ubuntu@VPS_IP

# On the VPS, populate /opt/iram366/.env with real values:
ssh ubuntu@VPS_IP
cd /opt/iram366
cp .env.example .env  # if not already
nano .env             # set PAYLOAD_SECRET, R2_*, DOMAIN, etc.

# Restart with the new env, then seed:
docker compose up -d
exit

# From your machine:
ssh ubuntu@VPS_IP "cd /opt/iram366 && ./deploy/seed-production.sh"
```

Your admin login: `iramnews366@gmail.com` / `${ADMIN_PASSWORD}` from `.env`.

## 3. Routine deploys

```bash
./deploy/deploy.sh ubuntu@VPS_IP
```

The script `rsync`s source, rebuilds the image, runs `docker compose up -d
--build`, runs `npm run migrate` inside the container, and prints `docker
compose ps`.

## 4. Database migrations

The Payload Postgres adapter no longer runs `push: true` in production. Instead:

```bash
# When you change a collection, generate a migration locally:
docker compose exec app npm run migrate:create -- --name add-foo

# Commit the file under src/payload/migrations/.
# On next deploy, deploy.sh runs `npm run migrate` automatically.
```

Inspect status: `docker compose exec app npm run migrate:status`.

## 5. Backups

- **Automated:** cron at 03:15 UTC via `deploy/backup.sh`. Streams `pg_dump | gzip` and uploads to `s3://${R2_BUCKET}/backups/YYYY/MM/DD/iram366-<ts>.sql.gz`. Older than 30 days are pruned automatically.
- **Manual run:** `/opt/iram366/deploy/backup.sh`
- **Logs:** `tail -f /var/log/iram366-backup.log`
- **Live cron entry:** `crontab -l` (root) — should show `15 3 * * * /opt/iram366/deploy/backup.sh ...`
- **Verify R2 contents:**
  ```bash
  set -a; source /opt/iram366/.env; set +a
  docker run --rm \
    -e AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
    -e AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
    -e AWS_DEFAULT_REGION=auto \
    amazon/aws-cli:latest s3 ls "s3://$R2_BUCKET/backups/" --recursive \
      --endpoint-url "https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"
  ```

The script uses the dockerized `amazon/aws-cli` image — no host-level awscli install required.

## 6. Restore

```bash
# 1. Download the dump (using docker aws-cli)
set -a; source /opt/iram366/.env; set +a
docker run --rm -v /tmp:/work \
  -e AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  -e AWS_DEFAULT_REGION=auto \
  amazon/aws-cli:latest \
  s3 cp "s3://$R2_BUCKET/backups/YYYY/MM/DD/iram366-<ts>.sql.gz" /work/restore.sql.gz \
    --endpoint-url "https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"

# 2. Stop app (keep db running)
docker compose stop app

# 3. Restore — wipes existing schema (--clean --if-exists in the dump)
gunzip -c restore.sql.gz | docker compose exec -T db psql -U $POSTGRES_USER -d $POSTGRES_DB

# 4. Restart app
docker compose start app
```

## 7. Troubleshooting

### App won't start

```bash
docker compose logs app --tail 200
docker compose ps   # check healthcheck status
```

Common causes: bad `DATABASE_URL`, missing `PAYLOAD_SECRET`, R2 credentials wrong.

### Database connection failures

```bash
docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB -c '\l'
```

### Payload migrations stuck

```bash
docker compose exec app npm run migrate:status
docker compose exec app npm run migrate
```

### Caddy TLS issues

Caddy logs to stdout. `docker compose logs caddy --tail 100`. Most issues are
DNS (the A record needs to point at the VPS IP before Caddy can issue a cert)
or rate limiting from Let's Encrypt (back off, fix DNS, try again in 1h).

### Disk filling up

```bash
# Prune unused docker images (safe)
docker system prune -af --volumes  # CAREFUL: --volumes removes named volumes

# Inspect log sizes
du -sh /var/lib/docker/containers/*/
```

The compose file caps each service's logs at 10MB × N files.

## 8. Rotating secrets

```bash
# Generate fresh secret
openssl rand -hex 32

# On the VPS:
nano /opt/iram366/.env  # update PAYLOAD_SECRET
docker compose restart app
```

Rotating `PAYLOAD_SECRET` invalidates all admin sessions — everyone re-logs in.

## 9. Scaling considerations

This stack is single-instance. Before going to multiple replicas:

- The in-memory rate limiter (`src/lib/rate-limit.ts`) becomes per-replica. Swap to Redis.
- React `cache()` is per-render — fine. `unstable_cache` with tags is shared via Next's cache backend.
- Payload admin sessions need sticky routing or a shared session store.

Realistic next step before multi-replica: **bigger VPS first**. Hetzner CX42
($16/mo) handles ~5k req/min on this stack.

## 10. Single-admin enforcement

Two layers:

1. **Application:** `src/payload/collections/Users.ts` `beforeValidate` hook.
2. **Database:** partial unique index `users_single_admin` (created by `deploy/postgres-init/10-single-admin.sql` on first DB boot).

If you ever need to change the admin: demote the existing one to editor first, then promote the new user.
