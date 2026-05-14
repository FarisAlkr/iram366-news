# VPS cron entries

Reference for what's scheduled on the production VPS via `root`'s crontab. If the VPS is ever rebuilt from scratch, these lines need to be re-installed by hand — `crontab` isn't synced by the deploy workflow. Source-of-truth lives here.

| When (UTC)                        | Command                                        | What it does                                                                                                                                                                                                                                                | Log file                            |
| --------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `0 3 * * *` (every day, 03:00)    | `/opt/iram366/scripts/backup-postgres.sh`      | Nightly Postgres backup → R2 with tiered retention (7 daily / 4 weekly / 3 monthly). See `scripts/backup-postgres.sh` and `docs/restore-from-backup.md`.                                                                                                    | `/var/log/iram366-backup.log`       |
| `0 4 * * 0` (every Sunday, 04:00) | `docker image prune -af --filter "until=168h"` | Weekly cleanup of Docker images older than 7 days that aren't referenced by any running container. Prevents image-layer accumulation from filling the disk. Build cache is NOT pruned by this entry — see "Forward note" below if it ever becomes an issue. | `/var/log/iram366-docker-prune.log` |

Scheduled 1 hour after the nightly backup to avoid contending for I/O on the small VPS during the backup's `pg_dump | gzip` step.

## Verbatim crontab lines

```cron
0 3 * * * /opt/iram366/scripts/backup-postgres.sh >> /var/log/iram366-backup.log 2>&1
0 4 * * 0 docker image prune -af --filter "until=168h" >> /var/log/iram366-docker-prune.log 2>&1
```

## Re-installing from scratch

```bash
ssh iram
(crontab -l 2>/dev/null | grep -v 'iram366\|docker image prune' ; cat <<'EOF'
0 3 * * * /opt/iram366/scripts/backup-postgres.sh >> /var/log/iram366-backup.log 2>&1
0 4 * * 0 docker image prune -af --filter "until=168h" >> /var/log/iram366-docker-prune.log 2>&1
EOF
) | crontab -

crontab -l   # verify
```

## Companion logrotate configs

Both log files have logrotate configs that need to be installed at `/etc/logrotate.d/`:

```bash
# Backup log
sudo cp /opt/iram366/deploy/iram366-backup.logrotate /etc/logrotate.d/iram366-backup
sudo chown root:root /etc/logrotate.d/iram366-backup
sudo chmod 644 /etc/logrotate.d/iram366-backup

# Docker-prune log
sudo cp /opt/iram366/deploy/iram366-docker-prune.logrotate /etc/logrotate.d/iram366-docker-prune
sudo chown root:root /etc/logrotate.d/iram366-docker-prune
sudo chmod 644 /etc/logrotate.d/iram366-docker-prune

# Verify (dry-run)
sudo logrotate -d /etc/logrotate.d/iram366-backup
sudo logrotate -d /etc/logrotate.d/iram366-docker-prune
```

Both configs are SCPed to `/opt/iram366/deploy/` on every deploy (see `.github/workflows/deploy.yml`'s SCP source list), so the templates always reflect the current repo state. The actual install at `/etc/logrotate.d/` is a one-time manual step — there's no automation to push files outside `/opt/iram366/`.

## Forward note — build cache cleanup

The weekly prune above targets images only, not build cache (`docker builder prune`). The 2026-05-14 manual disk cleanup recovered 26.57 GB from build cache that had accumulated over weeks of CI deploys, so the budget exists.

If the disk starts filling again over the next few months, the most likely cause is build cache re-accumulating. The conservative response would be to add a second weekly cron line:

```cron
30 4 * * 0 docker builder prune -af --filter "until=168h" >> /var/log/iram366-docker-prune.log 2>&1
```

Skipped today as a deliberate "do less now" call — see the original disk-cleanup brief's standing instruction that the safer iteration is shorter than the maximalist one.
