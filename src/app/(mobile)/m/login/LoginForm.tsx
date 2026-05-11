'use client'

import { useActionState } from 'react'
import { loginAction } from './actions'

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {})
  return (
    <form action={action} className="m-form" style={{ boxShadow: 'none', padding: 0 }}>
      {state?.error && <div className="m-error">{state.error}</div>}
      <div className="m-field">
        <label className="m-label" htmlFor="email">
          البريد الإلكتروني
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          inputMode="email"
          className="m-input"
          placeholder="example@iram366news.com"
        />
      </div>
      <div className="m-field">
        <label className="m-label" htmlFor="password">
          كلمة المرور
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="m-input"
        />
      </div>
      <button type="submit" disabled={pending} className="m-btn m-btn--gold">
        {pending ? '...' : 'دخول'}
      </button>
    </form>
  )
}
