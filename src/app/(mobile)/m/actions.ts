'use server'

import { revalidatePath } from 'next/cache'
import { headers as getHeaders } from 'next/headers'

import { logger } from '@/lib/logger'
import { getPayloadClient } from '@/lib/payload'
import { RateLimits, enforce } from '@/lib/rate-limit'

export interface ToggleBreakingState {
  ok: boolean
  /** Server-confirmed value — the client reconciles its optimistic state with it. */
  isBreaking?: boolean
  error?: string
}

/**
 * Flip an article's `isBreaking` flag from the mobile dashboard list — the
 * phone equivalent of the desktop admin's one-tap BreakingToggleCell.
 *
 * Server Actions go through Next's RPC and never touch the /api/* handlers,
 * so the rate limit has to be enforced here (same reasoning as the mobile
 * login action). `overrideAccess: false` keeps the collection's
 * `isOwnerOrAdminEditor('author')` update rule in force: an author can only
 * flag their own articles, admins and editors can flag any.
 */
export async function toggleBreakingAction(
  id: string | number,
  next: boolean,
): Promise<ToggleBreakingState> {
  const blocked = enforce({ headers: await getHeaders() }, RateLimits.mobileToggle)
  if (blocked) {
    const retryAfter = blocked.headers.get('Retry-After') ?? '60'
    return { ok: false, error: `محاولات كثيرة. أعد المحاولة بعد ${retryAfter} ثانية.` }
  }

  const articleId = typeof id === 'number' ? id : Number(id)
  if (!Number.isInteger(articleId) || articleId <= 0) {
    return { ok: false, error: 'معرّف المقال غير صالح.' }
  }

  const payload = await getPayloadClient()
  const auth = await payload.auth({ headers: await getHeaders() })
  if (!auth.user) return { ok: false, error: 'انتهت الجلسة. سجّل الدخول مجدداً.' }

  try {
    const updated = await payload.update({
      collection: 'articles',
      id: articleId,
      data: { isBreaking: next },
      user: auth.user,
      overrideAccess: false,
      depth: 0,
    })
    // The dashboard's عاجل counter is rendered server-side; without this it
    // keeps the pre-toggle number until the next full navigation.
    revalidatePath('/m')
    return { ok: true, isBreaking: Boolean((updated as { isBreaking?: unknown }).isBreaking) }
  } catch (err) {
    logger.error('mobile.breaking_toggle.failed', {
      err,
      articleId,
      next,
      userId: auth.user.id,
    })
    // Match on the error's name, not its message — Payload localizes
    // `message` (a Forbidden here reads "لا يسمح لك القيام بهذه العمليّة."),
    // so any English substring test would silently never fire.
    const name = err instanceof Error ? err.name : ''
    if (name === 'Forbidden') return { ok: false, error: 'لا تملك صلاحية تعديل هذا المقال.' }
    if (name === 'NotFound') return { ok: false, error: 'المقال غير موجود.' }
    return { ok: false, error: 'تعذّر تحديث حالة العاجل. حاول مجدداً.' }
  }
}
