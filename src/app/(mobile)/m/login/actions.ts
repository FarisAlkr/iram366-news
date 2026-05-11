'use server'

import { cookies, headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'

import { getPayloadClient } from '@/lib/payload'
import { RateLimits, enforce } from '@/lib/rate-limit'

export interface LoginState {
  error?: string
}

const COOKIE_NAME = 'payload-token'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year — matches Users.auth.tokenExpiration

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  // Per-IP rate limit. Server Actions go through Next's RPC and bypass the
  // bespoke /api/* routes, so without this the login flow has no throttling
  // at all. enforce() returns a 429 Response with Retry-After when blocked;
  // we translate that into the LoginState error contract.
  const blocked = enforce({ headers: await getHeaders() }, RateLimits.login)
  if (blocked) {
    const retryAfter = blocked.headers.get('Retry-After') ?? '60'
    return {
      error: `محاولات كثيرة. أعد المحاولة بعد ${retryAfter} ثانية.`,
    }
  }

  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!email || !password) {
    return { error: 'البريد الإلكتروني وكلمة المرور مطلوبان' }
  }

  try {
    const payload = await getPayloadClient()
    const result = await payload.login({
      collection: 'users',
      data: { email, password },
    })
    const token = result.token
    if (!token) return { error: 'فشل تسجيل الدخول' }

    const jar = await cookies()
    jar.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    })
  } catch {
    return { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }
  }

  redirect('/m')
}
