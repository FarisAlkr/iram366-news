import type { EmailAdapter, SendEmailOptions } from 'payload'

import { logger } from './logger.ts'

/**
 * Stub email adapter used while real SMTP is not yet wired (audit F-1.7-2,
 * see docs/post-launch-backlog.md → "SMTP / password reset").
 *
 * The default Payload behavior with no adapter at all is to log the rendered
 * email body to the server log and return success to the caller — which
 * means an admin clicking "Forgot Password" gets a "check your inbox"
 * confirmation while no email is actually delivered. That dishonest UX is
 * worse than a clear failure.
 *
 * This adapter instead:
 *
 *   1. Logs the attempted message (so a sysadmin can recover the reset
 *      link from the server log in a pinch — same behavior the default
 *      adapter offered).
 *   2. Throws a typed Error with a friendly Arabic message so Payload's
 *      forgotPassword endpoint surfaces a clear "feature in development"
 *      response instead of pretending the email went out.
 *
 * Swap this for `@payloadcms/email-nodemailer` (or any other real adapter)
 * once SMTP credentials are provisioned. The interface match means no other
 * code has to change.
 */
export const FEATURE_IN_DEVELOPMENT_MESSAGE =
  'هذه الميزة قيد التطوير حالياً. للحصول على رابط إعادة تعيين كلمة المرور، تواصل مع مدير الموقع.'

export const stubEmailAdapter: EmailAdapter<void> = () => ({
  name: 'stub',
  defaultFromAddress: 'no-reply@iram366news.com',
  defaultFromName: 'إرم 366 الإخبارية',
  async sendEmail(message: SendEmailOptions): Promise<void> {
    logger.warn('email.stub.skipped', {
      to: message.to,
      subject: message.subject,
      reason: 'SMTP not configured — stub adapter swallows the send',
    })
    throw new Error(FEATURE_IN_DEVELOPMENT_MESSAGE)
  },
})
