'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { getPayloadClient } from '@/lib/payload'

export interface LoginState {
  error?: string
}

const COOKIE_NAME = 'payload-token'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year — matches Users.auth.tokenExpiration

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
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
