# Post-launch backlog

Items deferred from Phase 2 of the pre-launch verification. Phase 3 will fill this out in full. Each entry should eventually carry: short description, why deferred, estimated effort (S/M/L), and a re-evaluation trigger.

---

## SMTP / password reset

- **Description.** Wire a real email adapter so `/admin` "Forgot Password" actually mails the reset link, and any future operational emails (subscriber notifications, comment moderation, etc.) can be sent.
- **Current state (2026-05-14).** A stub adapter in `src/lib/email-stub.ts` is registered as Payload's `email`. It logs every attempted send and throws a friendly Arabic "هذه الميزة قيد التطوير حالياً" message instead of pretending the email went out. The five `SMTP_*` slots in `.env.example` are intentionally documented as deferred.
- **Why deferred.** No SMTP relay is provisioned yet. Picking one (Gmail SMTP / SendGrid / Mailgun / Postmark / Resend) is a billing / account decision the client should make — not a launch blocker since editorial users currently coordinate password resets out-of-band.
- **How to unstub.** Install `@payloadcms/email-nodemailer` (or the chosen adapter), import it in `src/payload.config.ts`, and replace `email: stubEmailAdapter` with the real one. Populate the five `SMTP_*` entries in production `.env`. No other code changes needed.
- **Effort.** S (≈1 hour once the relay account exists).
- **Re-evaluation trigger.** First real password-reset request from an editor, or any feature that needs to email subscribers.

---

(More entries arrive in Phase 3.)
