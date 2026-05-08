'use client'

import React from 'react'

import { ArticleStatus } from '@/domain/enums'

interface StatusCellProps {
  cellData?: unknown
}

const STATUS_META: Record<
  string,
  { label: string; tone: 'success' | 'warning' | 'info' | 'muted' }
> = {
  [ArticleStatus.Draft]: { label: 'مسودة', tone: 'info' },
  [ArticleStatus.InReview]: { label: 'قيد المراجعة', tone: 'warning' },
  [ArticleStatus.Published]: { label: 'منشور', tone: 'success' },
  [ArticleStatus.Archived]: { label: 'مؤرشف', tone: 'muted' },
}

/**
 * Cell renderer for the Articles list "status" column.
 * Replaces plain text with a colored pill + dot indicator.
 */
export const StatusCell: React.FC<StatusCellProps> = ({ cellData }) => {
  const key = typeof cellData === 'string' ? cellData : ''
  const meta = STATUS_META[key] ?? { label: key || '—', tone: 'muted' as const }

  return (
    <span className={`iram-status-pill iram-status-pill--${meta.tone}`} dir="rtl">
      <span className="iram-status-pill__dot" aria-hidden />
      {meta.label}
    </span>
  )
}

export default StatusCell
