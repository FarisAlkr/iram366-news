'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'

import { computeStats } from '@/lib/article-stats'

/**
 * Live word/character/reading-time bar shown beneath the article body.
 * Recalculates on every keystroke via Payload's form-field subscription.
 */
export const ReadingTimeStats: React.FC = () => {
  const body = useFormFields(([fields]) => fields?.body?.value)

  const stats = React.useMemo(() => computeStats(body), [body])

  // Format Arabic-Latin numerals so the digits remain readable in RTL.
  const fmt = (n: number) => n.toLocaleString('ar-EG-u-nu-latn')

  const empty = stats.words === 0
  const minutesLabel =
    stats.readingMinutes === 0
      ? '—'
      : stats.readingMinutes === 1
        ? 'دقيقة واحدة'
        : stats.readingMinutes === 2
          ? 'دقيقتان'
          : stats.readingMinutes <= 10
            ? `${fmt(stats.readingMinutes)} دقائق`
            : `${fmt(stats.readingMinutes)} دقيقة`

  return (
    <div className="iram-stats" dir="rtl" data-empty={empty || undefined}>
      <div className="iram-stats__cell">
        <span className="iram-stats__icon" aria-hidden>
          📝
        </span>
        <div>
          <div className="iram-stats__label">عدد الكلمات</div>
          <div className="iram-stats__value">{fmt(stats.words)}</div>
        </div>
      </div>
      <div className="iram-stats__cell">
        <span className="iram-stats__icon" aria-hidden>
          🔤
        </span>
        <div>
          <div className="iram-stats__label">عدد الأحرف</div>
          <div className="iram-stats__value">{fmt(stats.characters)}</div>
        </div>
      </div>
      <div className="iram-stats__cell">
        <span className="iram-stats__icon" aria-hidden>
          ⏱️
        </span>
        <div>
          <div className="iram-stats__label">وقت القراءة المتوقع</div>
          <div className="iram-stats__value">{minutesLabel}</div>
        </div>
      </div>
    </div>
  )
}

export default ReadingTimeStats
