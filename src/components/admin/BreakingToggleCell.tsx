'use client'

import React from 'react'

interface BreakingToggleCellProps {
  cellData?: unknown
  rowData?: { id?: number | string }
  /** Some Payload v3 builds pass row data under different keys — accept all. */
  doc?: { id?: number | string }
}

/**
 * Clickable Cell for the `isBreaking` column on the Articles list. One tap
 * toggles the article's breaking-news status without opening the document.
 *
 * - Red badge "🔴 عاجل" when on
 * - Faded "إضافة" pill when off
 * - PATCH /api/articles/:id flips the value, optimistic UI
 *
 * Click bubbling is stopped so the row's default link-click (opening the
 * article) doesn't fire.
 */
export const BreakingToggleCell: React.FC<BreakingToggleCellProps> = ({
  cellData,
  rowData,
  doc,
}) => {
  const id = rowData?.id ?? doc?.id
  const [breaking, setBreaking] = React.useState(Boolean(cellData))
  const [busy, setBusy] = React.useState(false)
  const [errored, setErrored] = React.useState(false)

  // Sync state if cellData changes externally (e.g. list re-renders)
  React.useEffect(() => {
    setBreaking(Boolean(cellData))
  }, [cellData])

  if (id === undefined || id === null) {
    return <span className="iram-bk-cell">—</span>
  }

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    const next = !breaking
    setBreaking(next) // optimistic
    setBusy(true)
    setErrored(false)
    try {
      const res = await fetch(`/api/articles/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBreaking: next }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch {
      // Revert on failure
      setBreaking(!next)
      setErrored(true)
      setTimeout(() => setErrored(false), 2500)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={`iram-bk-cell ${breaking ? 'iram-bk-cell--on' : 'iram-bk-cell--off'} ${
        busy ? 'iram-bk-cell--busy' : ''
      } ${errored ? 'iram-bk-cell--error' : ''}`}
      onClick={toggle}
      disabled={busy}
      aria-pressed={breaking}
      aria-label={breaking ? 'إزالة من شريط العاجل' : 'إضافة إلى شريط العاجل'}
      title={
        errored
          ? 'فشل الطلب — حاول مرة أخرى'
          : breaking
            ? 'انقر لإزالة من العاجل'
            : 'انقر لإضافة إلى العاجل'
      }
    >
      {errored ? '⚠ خطأ' : breaking ? '🔴 عاجل' : '+ عاجل'}
    </button>
  )
}

export default BreakingToggleCell
