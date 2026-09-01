'use client'

import { useEffect, useState, useTransition } from 'react'

import { toggleBreakingAction } from './actions'

interface Props {
  id: number | string
  initial: boolean
}

const ERROR_CLEAR_MS = 3500

/**
 * One-tap عاجل switch for a row in the mobile dashboard list. Mirrors the
 * desktop admin's BreakingToggleCell: optimistic flip, revert + inline
 * message on failure.
 */
export function BreakingToggle({ id, initial }: Props) {
  const [breaking, setBreaking] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // The action revalidates /m, so a re-render can arrive with a newer server
  // value (e.g. the same article toggled from the desktop admin meanwhile).
  useEffect(() => {
    setBreaking(initial)
  }, [initial])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), ERROR_CLEAR_MS)
    return () => clearTimeout(t)
  }, [error])

  const toggle = () => {
    if (pending) return
    const next = !breaking
    setBreaking(next)
    setError(null)
    startTransition(async () => {
      const res = await toggleBreakingAction(id, next)
      if (res.ok) {
        if (typeof res.isBreaking === 'boolean') setBreaking(res.isBreaking)
      } else {
        setBreaking(!next)
        setError(res.error ?? 'تعذّر التحديث.')
      }
    })
  }

  return (
    <div className="m-breaking">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={breaking}
        aria-label={breaking ? 'إزالة من شريط العاجل' : 'إضافة إلى شريط العاجل'}
        className={`m-breaking__btn ${
          breaking ? 'm-breaking__btn--on' : 'm-breaking__btn--off'
        } ${error ? 'm-breaking__btn--error' : ''}`}
      >
        {error ? '⚠ خطأ' : breaking ? '🔴 عاجل' : '+ عاجل'}
      </button>
      {error && (
        <span className="m-breaking__error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
