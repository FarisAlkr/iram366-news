import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const COOKIE_NAME = 'payload-token'

async function clearAndRedirect() {
  const jar = await cookies()
  jar.set(COOKIE_NAME, '', { path: '/', maxAge: 0 })
  return NextResponse.redirect(
    new URL('/m/login', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  )
}

export async function GET() {
  return clearAndRedirect()
}

export async function POST() {
  return clearAndRedirect()
}
