# IRAM 366 News — Next Steps

_Last updated: 2026-05-09. Open this when you wake up and work top-to-bottom._

---

## Where things stand right now

- ✅ Public site: <https://iram366news.com>
- ✅ Admin panel: <https://iram366news.com/admin>
- ✅ Mobile dashboard: <https://iram366news.com/m>
- ✅ Stats page: <https://iram366news.com/admin/stats>
- ✅ AI chatbot active — finds articles by description (OpenAI embeddings)
- ✅ Custom CDN: media.iram366news.com (Cloudflare-backed)
- ✅ GitHub Actions CI/CD — every `git push` to main rebuilds + deploys
- ✅ Repo: <https://github.com/FarisAlkr/iram366-news> (private)
- ✅ 36 articles already embedded for the chatbot
- ✅ Backup script exists at `deploy/backup.sh` (not yet scheduled)

---

## 🔴 CRITICAL — must do before client handoff

### 1. Rotate the OpenAI API key (5 min)

The current key was pasted in chat history. Treat as compromised.

- Go to <https://platform.openai.com/api-keys>
- Delete the **IRAM366-NEWS-VPS** key (trash icon)
- Click **+ Create new secret key**
  - Name: `IRAM366-NEWS-VPS`
  - Permissions: **Restricted** → only **Embeddings** = Write
- Copy the new `sk-…` key
- Paste it to the developer in the next chat session, who will swap it on the VPS

### 2. Strong admin password (3 min)

- Log into `/admin`
- Top-right avatar → **Account** → **Change password**
- 14+ chars, save in a password manager (1Password, Bitwarden, etc.)
- Repeat for any editor/author accounts you've created

### 3. Schedule nightly DB backups (1 min — ask developer to run)

The `deploy/backup.sh` script is ready but not on cron. Ask the developer to run:

```
ssh iram "(crontab -l 2>/dev/null; echo '0 3 * * * /opt/iram366/deploy/backup.sh >> /var/log/iram-backup.log 2>&1') | crontab -"
```

### 4. SMTP setup so editors can reset forgotten passwords (10 min)

Without SMTP, "Forgot password" emails go to the server console only.

Sign up at one of:

- **SendGrid** (free 100/day) — easiest: sendgrid.com → Settings → API Keys → Create
- **Brevo** (free 300/day) — brevo.com
- **Resend** (free 3000/month) — resend.com

You'll get SMTP credentials (host, port, user, password). Paste them to the developer who will add to `/opt/iram366/.env`:

```
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM_ADDRESS=noreply@iram366news.com
```

### 5. Seed initial content (1–2 hours)

In the admin:

- [ ] Verify all categories exist: المحلية, السياسة, الصحة, الفيديوهات, الاقتصاد, etc.
- [ ] At least 3–5 published articles per category (so the homepage doesn't look empty)
- [ ] Featured image on every published article
- [ ] Set a Hero in **Site Settings → الصفحة الرئيسية → الوضع: يدوي** + pick the lead story
- [ ] Confirm WhatsApp / YouTube / Telegram / Instagram / Facebook URLs are filled in **Site Settings → روابط التواصل الاجتماعي**

### 6. Legal / About pages (1 hour)

News sites need these for credibility + GDPR compliance for the analytics beacon.

In the admin → **Pages** → Create:

- [ ] **من نحن** (About) — who runs the site, what's the editorial mission
- [ ] **سياسة الخصوصية** (Privacy Policy) — required for using Cloudflare Analytics
- [ ] **شروط الاستخدام** (Terms of Use)
- [ ] **تواصل معنا** (Contact) — phone, email, WhatsApp, address

> **Tip:** ask the developer to "draft Arabic legal page boilerplate" — they can give you a starter template you customize.

---

## 🟡 Optional but recommended (do after #1–6)

### 7. Cloudflare Analytics audience numbers (Section B of stats page)

The placeholder block on `/admin/stats` lights up automatically when these env vars are set:

- Go to <https://dash.cloudflare.com/profile/api-tokens>
- Click **Create Token** → "Custom token"
- Name: `iram-analytics-read`
- Permissions: **Account → Account Analytics → Read**
- Account Resources: **Include → All accounts** (or specific to iram366news.com)
- Save → copy the token
- Also grab your **Account ID** (visible in any Cloudflare site overview's right sidebar)
- Paste both to the developer

### 8. Uptime monitoring (3 min, free)

- Sign up at <https://uptimerobot.com> (free)
- Add monitor: HTTP(s), URL `https://iram366news.com`, interval 5 min
- Add your email/phone for alerts
- You'll get notified within minutes if the site goes down

### 9. Activate WhatsApp / Telegram / YouTube auto-posting (later)

The site can auto-share new articles to these platforms when they're published. Requires:

- WhatsApp Channels: not possible (Meta API limitation)
- Telegram: easiest — bot token + channel ID, ~30 min setup
- Facebook Page: medium — needs Meta App + Page Access Token, app review takes 1–7 days

Ask the developer when ready.

---

## 🟢 Production polish (post-launch nice-to-haves)

- **Bigger VPS** — current 4GB RAM is tight. 8GB ($5/mo upgrade) speeds up deploys.
- **Sentry** error tracking — free tier 5k events/month. Catches crashes visitors hit silently.
- **Staging environment** — a copy at `staging.iram366news.com` for testing risky changes.
- **Lighthouse audit** — Chrome DevTools → Lighthouse → run on homepage. Aim for >90 in all categories.

---

## Quick reference (give this to the developer next session)

| Thing          | Where                                                                             |
| -------------- | --------------------------------------------------------------------------------- |
| Code           | `/home/faris/Desktop/MyWork/IRAM 366 News Platform/iram366-news/`                 |
| GitHub         | github.com/FarisAlkr/iram366-news (private)                                       |
| VPS SSH        | `ssh iram` (alias for root@187.124.219.77)                                        |
| VPS env        | `/opt/iram366/.env`                                                               |
| VPS app dir    | `/opt/iram366/`                                                                   |
| Deploy         | `git push origin main` (auto via GH Actions)                                      |
| Manual restart | `ssh iram "cd /opt/iram366 && docker compose pull app && docker compose up -d"`   |
| DB shell       | `ssh iram "cd /opt/iram366 && docker compose exec db psql -U iram366 -d iram366"` |
| App logs       | `ssh iram "cd /opt/iram366 && docker compose logs app --tail=100"`                |
| GH Actions     | <https://github.com/FarisAlkr/iram366-news/actions>                               |
| OpenAI usage   | <https://platform.openai.com/usage>                                               |
| Cloudflare     | <https://dash.cloudflare.com>                                                     |
| R2 bucket      | iram366-media (custom domain media.iram366news.com)                               |

---

## What's already known to be flaky / TODO bug list

- Article-create blank screen — narrowed to a missing column in the `_articles_v` versions table whenever a new field is added to Articles. Each new field needs `ALTER TABLE _articles_v ADD COLUMN version_<name> ...`. Document this in any future field addition.
- The GitHub Actions SCP step occasionally times out (network blip). Manual fix: `ssh iram "cd /opt/iram366 && docker compose pull app && docker compose up -d"` from the developer's machine. Considering adding a retry to the workflow.
- TypeScript build is slow on the production VPS (4GB RAM) — that's why we moved to GH Actions builds. Keep using GH Actions.

---

## When you're done with #1–6 you're ready to deliver

Pre-flight checklist:

- [ ] Admin password rotated, written down securely
- [ ] All editors have credentials (write them down to give the client)
- [ ] OpenAI key rotated
- [ ] Backups running on cron (verify with `ssh iram "ls -la /opt/iram366/backups/"`)
- [ ] SMTP works (try Forgot Password from /admin)
- [ ] At least 15 articles published, hero set, social links filled
- [ ] About / Privacy / Terms / Contact pages exist
- [ ] Mobile site looks right on a real phone
- [ ] Open the site in incognito and click around for 5 minutes — fresh eyes catch breakage
- [ ] Final manual backup just before delivery: `ssh iram "/opt/iram366/deploy/backup.sh"`

Then write a short "كيف تستخدم الموقع" guide for your client (1–2 pages) covering: login, create article, mark breaking, set hero, mobile dashboard. Hand over with the credentials.

You're done.
