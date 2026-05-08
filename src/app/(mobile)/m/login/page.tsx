import { redirect } from 'next/navigation'

import { getMobileUser } from '../auth'
import { LoginForm } from './LoginForm'

export const dynamic = 'force-dynamic'

export default async function MobileLoginPage() {
  const user = await getMobileUser()
  if (user) redirect('/m')
  return (
    <div className="m-login-wrap">
      <div className="m-login-card">
        <div className="m-login-card__brand">
          <img src="/splash-logo.jpeg" alt="" aria-hidden />
          <div className="m-login-card__title">تسجيل الدخول — لوحة الجوال</div>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
