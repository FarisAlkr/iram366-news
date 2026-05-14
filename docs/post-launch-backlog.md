# Post-launch backlog

Items deferred from the pre-launch verification work. Phase 3 will fill this out in full. Each entry should eventually carry: short description, why deferred, estimated effort (S/M/L), and a re-evaluation trigger.

---

## Deferred work

### SMTP / password-reset email

**Status (2026-05-14): formally deferred past launch.** The current behavior is honest and acceptable for the project's launch user base.

#### Current state

`src/lib/email-stub.ts` is registered as Payload's email adapter. When an editor clicks "نسيت كلمة المرور" in `/admin`, the stub:

1. Logs the attempted send to the server log (so a sysadmin can recover the reset link from logs in a pinch — same behavior Payload's default `consoleEmailAdapter` offered).
2. Throws an `Error` whose message is `"هذه الميزة قيد التطوير حالياً. للحصول على رابط إعادة تعيين كلمة المرور، تواصل مع مدير الموقع."`

Payload surfaces that error string back to the admin UI. The user sees a clear "feature in development, contact the site admin" message instead of a fake "check your inbox" success toast that never delivers. **The password-reset feature has not silently broken — it's clearly not yet built.** That distinction matters: silent failure would erode trust; honest failure preserves it.

#### Deferral rationale

The site launches with **1–2 admin users** (the client + the developer). Both can store their credentials in a password manager. The realistic frequency of a password-reset event over the first few months is ~zero. Manual recovery — direct DB update via SSH if it ever comes up — is operationally trivial for the size of the user base.

The cost of wiring SMTP before launch is **either DNS work for a real domain, or a tradeoff against professionalism** if we settle for a sandbox sender. Neither is justified by the actual operational need. Easy to revisit once any of: (a) editorial team grows past ~5 users, (b) we want to email subscribers from `/admin`, (c) any future feature requires outbound mail.

#### Implementation options (when the time comes)

Pick one. All three have roughly the same code surface (replace `stubEmailAdapter` with the real adapter in `src/payload.config.ts`); they differ only in setup cost and deliverability quality.

| Option                                                            | DNS work                                                      | Time to ship                                        | Sender appearance                                                                                                                     | Limit                 | Cost              |
| ----------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----------------- |
| **A — Resend with real domain** (`noreply@iram366news.com`)       | 2–3 TXT records on Cloudflare (SPF + DKIM + optionally DMARC) | ~30 min total once Resend account exists            | Professional — mail comes from the site's own domain                                                                                  | 3,000/month free tier | Free at our scale |
| **B — Resend sandbox** (`onboarding@resend.dev`)                  | None                                                          | ~5 min                                              | Unprofessional — every reset email shows "via resend.dev" in clients, which looks like a phishing attempt to non-technical recipients | 100/day sandbox limit | Free              |
| **C — Gmail SMTP** with `iramnews366@gmail.com` + an App Password | None                                                          | ~20 min (Google account → Security → App Passwords) | Professional — mail comes from the existing editorial inbox the client already owns                                                   | ~500/day              | Free              |

#### Recommendation when we revisit

**Option A (Resend with real domain)** is the strategic choice. It's the only path that scales cleanly past password-reset to outbound subscriber email — the SPF/DKIM records are a one-time setup, after which any volume up to 3,000/month is one-click.

**Option C (Gmail SMTP)** is the pragmatic fallback if Resend setup hits a snag. It's instant, professional-looking, and adequate for password-reset + ad-hoc admin notifications. The 500/day limit is easily enough for that workload. Migrating from Option C to Option A later is straightforward — same Payload adapter, different SMTP credentials.

**Option B (sandbox)** should only be considered for testing the SMTP wiring itself. Don't ship it.

#### How to unstub (any option)

1. Install the matching adapter: `npm install @payloadcms/email-nodemailer` (covers all three options above — Resend's SMTP endpoint and Gmail SMTP both speak the same protocol).
2. Replace `email: stubEmailAdapter` in `src/payload.config.ts` with the configured nodemailer adapter.
3. Populate the `SMTP_*` slots already documented in `.env.example` — both in `.env` on the VPS (Rule 2) and as forwarded vars in the compose `environment:` block (already present, set to `${VAR:-}` defaults).
4. Force-recreate the app container so the new env reaches the runtime.
5. Test: trigger a real password reset, verify the email arrives, verify the link works end-to-end.

Effort: **S** (≈1 hour once the chosen provider's account exists and the credential is in hand).

#### Re-evaluation triggers

- First actual password-reset request from a real editor.
- Editorial team grows past ~5 users.
- Any new feature requires outbound mail to readers (subscriber digests, comment moderation, alert thresholds, etc.).

---

(More entries arrive in Phase 3.)
