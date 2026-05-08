import { cookies, headers as getHeaders } from 'next/headers'

import { getPayloadClient } from '@/lib/payload'
import type { User } from '@/types/payload'

const COOKIE_NAME = 'payload-token'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

/**
 * Read the current authenticated user from the request cookies via
 * Payload's local auth helper. Returns null if not signed in.
 *
 * On every successful auth, refresh the cookie's maxAge so the session
 * keeps rolling forward — a daily user effectively never logs out. Combined
 * with the 1-year `tokenExpiration` on the Users collection, a client only
 * has to re-login if they don't visit for a full year.
 */
export async function getMobileUser(): Promise<User | null> {
  try {
    const payload = await getPayloadClient()
    const headers = await getHeaders()
    const result = await payload.auth({ headers })
    if (!result.user) return null

    // Sliding session — re-set the cookie with a fresh expiry every visit.
    try {
      const jar = await cookies()
      const existing = jar.get(COOKIE_NAME)
      if (existing?.value) {
        jar.set(COOKIE_NAME, existing.value, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: COOKIE_MAX_AGE,
        })
      }
    } catch {
      // Setting cookies in some Next.js contexts (e.g. when called from
      // an already-streamed response) throws — ignore, the next visit
      // will retry.
    }

    return result.user as unknown as User
  } catch {
    return null
  }
}
