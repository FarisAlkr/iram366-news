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
 * This component restores parity in two interaction modes:
 *
 *   1. Click the button → native OS multi-file picker → select many at
 *      once → all upload in sequence.
 *   2. Drag files from a folder / desktop window directly onto the drop
 *      zone (the gold-bordered box) → release → all upload in sequence.
 *
 * Both paths feed the same processFiles() helper, so the upload behavior
 * (sequential POST to /api/media, alt-text fallback, per-file error
 * handling, single bulk dispatch at end) is identical.
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
 *  - Drag-and-drop: dragenter/dragover/dragleave are counted via a ref
 *    rather than a plain boolean because dragover fires per child element;
 *    a naive boolean flips false/true rapidly as the cursor crosses
 *    internal nodes. The counter only flips visual state when the dragenter
 *    count goes to zero.
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

function filterImageFiles(list: FileList | File[]): File[] {
  return Array.from(list).filter((f) => f.size > 0 && f.type.startsWith('image/'))
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
  const [dragActive, setDragActive] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  // dragenter/dragover/dragleave fire per child element as the cursor
  // moves across them. A plain boolean would flicker. Counter pattern:
  // increment on dragenter, decrement on dragleave; visual is active
  // while counter > 0.
  const dragCounterRef = React.useRef(0)

  const processFiles = React.useCallback(
    async (rawFiles: File[]) => {
      if (rawFiles.length === 0) return

      // Snapshot now to avoid races: if the editor's typing in another
      // field while uploads run, we don't want our dispatch to clobber
      // their edits. We mutate the snapshot and write the whole array
      // back at the end.
      const baseGallery: GalleryRow[] = Array.isArray(gallery) ? [...(gallery as GalleryRow[])] : []
      const titleStr = typeof title === 'string' ? title : ''
      const altBase = titleStr ? titleStr.slice(0, ALT_MAX_LEN) : ''

      setBusy(true)
      setStatuses(rawFiles.map((f) => ({ name: f.name, state: 'pending' })))

      const newRows: GalleryRow[] = []
      for (let i = 0; i < rawFiles.length; i++) {
        const file = rawFiles[i]
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
            prev.map((s, idx) =>
              idx === i ? { ...s, state: 'error', message: 'فشل الاتصال' } : s,
            ),
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
    },
    [gallery, title, dispatchFields],
  )

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    const files = filterImageFiles(fileList)
    // Reset the input so the editor can re-pick the same file after
    // removing a row.
    if (inputRef.current) inputRef.current.value = ''
    await processFiles(files)
  }

  const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    // Only react to drags that contain files. dragging text, a link, an
    // image from elsewhere in the page → ignore.
    if (!e.dataTransfer?.types?.includes('Files')) return
    e.preventDefault()
    dragCounterRef.current += 1
    if (!dragActive) setDragActive(true)
  }

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    // Required to allow drop. Without preventDefault on dragover, the
    // browser refuses the drop and falls back to navigating to the
    // file's URL (which on a local file means a useless file:// nav).
    if (!e.dataTransfer?.types?.includes('Files')) return
    e.preventDefault()
    // Indicate this is a copy-from-OS, not a move. Browsers display a
    // "+ copy" cursor with this hint, matching editor intuition that
    // dragging from a folder shouldn't move/delete the source file.
    e.dataTransfer.dropEffect = 'copy'
  }

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer?.types?.includes('Files')) return
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
    if (dragCounterRef.current === 0) setDragActive(false)
  }

  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer?.types?.includes('Files')) return
    e.preventDefault()
    dragCounterRef.current = 0
    setDragActive(false)
    const dropped = e.dataTransfer.files
    if (!dropped || dropped.length === 0) return
    const files = filterImageFiles(dropped)
    await processFiles(files)
  }

  const pickedCount = statuses.length
  const okCount = statuses.filter((s) => s.state === 'ok').length
  const errorCount = statuses.filter((s) => s.state === 'error').length

  const containerClass = `iram-bulk-gallery${dragActive ? ' iram-bulk-gallery--drag' : ''}`

  return (
    <div
      className={containerClass}
      dir="rtl"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
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
        اختر عدة صور دفعة واحدة، أو اسحبها من مجلدك وأفلتها هنا — ستضاف إلى المعرض أدناه. أضف
        التعليق لكل صورة من السطر المقابل بعد الرفع.
      </small>

      {/* Drop overlay — only visible while a file drag is hovering. The
          overlay is `pointer-events: none` in CSS so it doesn't interfere
          with the underlying drop event bubbling up to the container. */}
      {dragActive && (
        <div className="iram-bulk-gallery__drop-overlay" aria-hidden>
          <span>أفلت الصور هنا للرفع</span>
        </div>
      )}

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
