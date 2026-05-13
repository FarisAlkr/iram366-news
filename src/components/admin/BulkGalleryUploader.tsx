'use client'

import React from 'react'
import { useForm, useFormFields } from '@payloadcms/ui'

/**
 * Bulk multi-file uploader for the Articles gallery field.
 *
 * Mobile `/m/new` uses a native `<input type="file" multiple>` and uploads
 * each picked file to /api/media in a server action, then attaches the
 * resulting media IDs to the article's gallery. The Payload `/admin` UI
 * only lets editors click "Add Row" one file at a time, which the editor
 * called out as a productivity gap.
 *
 * This component restores parity: one click → pick many files → all of
 * them stream up to /api/media → each successful upload appends a row
 * to the existing gallery array field. Captions stay empty (editable
 * per-row after upload, same as before).
 *
 * Implementation notes:
 *  - Uploads are sequential (for-of with await). Parallel would be faster
 *    but a slow connection + a 10-image batch could OOM the browser or
 *    saturate the upload pipe; serial gives per-file progress and predictable
 *    failure behavior.
 *  - `alt` text is auto-derived: prefer the article title, fall back to the
 *    filename stem. Editors can refine alt later by clicking through to the
 *    individual media doc. The Media collection requires `alt`, so we must
 *    supply something on POST or the upload 400s.
 *  - On per-file failure we log + show a small error chip; the rest of the
 *    batch continues. Same behavior the mobile flow has — a failed gallery
 *    upload never aborts the others.
 *  - We don't touch the existing gallery rows — we only append. So the
 *    editor can mix bulk-uploaded images with hand-added ones freely.
 */

type GalleryRow = {
  image?: string | number | { id: string | number } | null
  caption?: string | null
  id?: string
}

interface UploadStatus {
  name: string
  state: 'pending' | 'ok' | 'error'
  message?: string
}

const ALT_MAX_LEN = 120 // soft cap; matches the mobile flow's title truncation

function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

export const BulkGalleryUploader: React.FC = () => {
  const { dispatchFields } = useForm()
  // Read the current title (for alt-text default) and the live gallery
  // array snapshot (so we can append to it without dropping prior rows).
  const { title, gallery } = useFormFields(([fields]) => ({
    title: fields?.title?.value,
    gallery: fields?.gallery?.value,
  }))

  const [busy, setBusy] = React.useState(false)
  const [statuses, setStatuses] = React.useState<UploadStatus[]>([])
  const inputRef = React.useRef<HTMLInputElement>(null)

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return

    // Snapshot now to avoid races: if the editor's typing in another
    // field while uploads run, we don't want our dispatch to clobber
    // their edits. We mutate the snapshot and write the whole array
    // back at the end.
    const baseGallery: GalleryRow[] = Array.isArray(gallery) ? [...(gallery as GalleryRow[])] : []
    const titleStr = typeof title === 'string' ? title : ''
    const altBase = titleStr ? titleStr.slice(0, ALT_MAX_LEN) : ''

    const files = Array.from(fileList).filter((f) => f.size > 0 && f.type.startsWith('image/'))

    // Reset the input now so the editor can immediately pick more if
    // they want to (or re-pick the same file after removing a row).
    if (inputRef.current) inputRef.current.value = ''

    setBusy(true)
    setStatuses(files.map((f) => ({ name: f.name, state: 'pending' })))

    const newRows: GalleryRow[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file) continue
      const alt = altBase || stripExtension(file.name).slice(0, ALT_MAX_LEN) || 'image'

      // Payload's REST endpoint for upload collections accepts
      // multipart/form-data with a `file` part plus a `_payload`
      // JSON string carrying the rest of the fields. (`alt` is the
      // only required Media field.)
      const fd = new FormData()
      fd.append('file', file)
      fd.append('_payload', JSON.stringify({ alt }))

      try {
        const res = await fetch('/api/media', {
          method: 'POST',
          body: fd,
          credentials: 'include',
        })
        if (!res.ok) {
          let message = 'فشل الرفع'
          try {
            const body = (await res.json()) as { errors?: { message?: string }[] }
            const first = body?.errors?.[0]?.message
            if (first) message = first
          } catch {
            /* not JSON — leave message generic */
          }
          setStatuses((prev) =>
            prev.map((s, idx) => (idx === i ? { ...s, state: 'error', message } : s)),
          )
          continue
        }
        const data = (await res.json()) as { doc?: { id?: string | number } }
        const mediaId = data?.doc?.id
        if (!mediaId) {
          setStatuses((prev) =>
            prev.map((s, idx) =>
              idx === i ? { ...s, state: 'error', message: 'استجابة غير متوقعة' } : s,
            ),
          )
          continue
        }
        newRows.push({ image: mediaId, caption: '' })
        setStatuses((prev) => prev.map((s, idx) => (idx === i ? { ...s, state: 'ok' } : s)))
      } catch (err) {
        // Network / CORS / aborted — log and move on. The other files
        // in the batch still get a chance.
        console.error('[bulk gallery] upload failed:', err)
        setStatuses((prev) =>
          prev.map((s, idx) => (idx === i ? { ...s, state: 'error', message: 'فشل الاتصال' } : s)),
        )
      }
    }

    // One bulk write at the end. Payload's array dispatch wants the
    // whole new array; pushing rows one-by-one would re-render the
    // editor N times and lose intermediate field focus.
    if (newRows.length > 0) {
      dispatchFields({
        type: 'UPDATE',
        path: 'gallery',
        value: [...baseGallery, ...newRows],
      })
    }

    setBusy(false)
  }

  const pickedCount = statuses.length
  const okCount = statuses.filter((s) => s.state === 'ok').length
  const errorCount = statuses.filter((s) => s.state === 'error').length

  return (
    <div className="iram-bulk-gallery" dir="rtl">
      <label className="iram-bulk-gallery__btn">
        <span aria-hidden>🖼️</span>
        <span>{busy ? '... جاري الرفع' : 'اختر صوراً للمعرض (دفعة واحدة)'}</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onPick}
          disabled={busy}
          aria-label="رفع عدة صور للمعرض"
        />
      </label>

      <small className="iram-bulk-gallery__hint">
        اختر عدة صور دفعة واحدة — ستضاف إلى المعرض أدناه. أضف التعليق لكل صورة من السطر المقابل بعد
        الرفع.
      </small>

      {pickedCount > 0 && (
        <div className="iram-bulk-gallery__status" aria-live="polite">
          {busy ? (
            <span>
              {okCount} من {pickedCount} اكتمل
            </span>
          ) : (
            <span>
              تم رفع {okCount} من {pickedCount}
              {errorCount > 0 ? ` — فشلت ${errorCount}` : ''}
            </span>
          )}
          {errorCount > 0 && (
            <ul className="iram-bulk-gallery__errors">
              {statuses
                .filter((s) => s.state === 'error')
                .map((s, idx) => (
                  <li key={idx}>
                    <strong>{s.name}</strong>
                    {s.message ? ` — ${s.message}` : ''}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default BulkGalleryUploader
