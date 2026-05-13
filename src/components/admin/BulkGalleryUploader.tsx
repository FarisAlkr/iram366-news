'use client'

import React from 'react'
import { useForm, useFormFields } from '@payloadcms/ui'

/**
 * Bulk multi-file uploader for the Articles gallery field.
 *
 * Two equivalent interaction modes:
 *   1. Click anywhere on the box → native OS multi-file picker opens.
 *   2. Drag files from a folder window onto the box → release → upload.
 *
 * Drop handlers are attached via native `addEventListener` on the DOM
 * node (NOT React's synthetic onDrop/onDragOver). The synthetic-event
 * version failed silently in the field — most likely cause is Payload's
 * admin using react-dnd's HTML5Backend, which registers drag listeners
 * at the window level and can interfere with React's synthetic event
 * delivery. Native element listeners run regardless of what synthetic
 * dispatch is doing and let us call stopPropagation on the drop so
 * react-dnd's window-level handler never sees the file drop.
 *
 * Diagnostic console.logs are intentional — earlier deploys reported
 * "doesn't work" without any way to see why. The logs are namespaced
 * "[bulk-gallery]" so editors can grep DevTools console output.
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

const ALT_MAX_LEN = 120

// Permissive image detection — MIME OR extension allowlist. The MIME-only
// check rejected files arriving with empty `.type` (drag from chat clients,
// some cloud-sync apps, OS shells without registered MIME).
const IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.jpe',
  '.jfif',
  '.png',
  '.gif',
  '.webp',
  '.avif',
  '.heic',
  '.heif',
  '.tiff',
  '.tif',
  '.bmp',
  '.svg',
] as const

function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

function isImageFile(f: File): boolean {
  if (f.size <= 0) return false
  if (f.type && f.type.startsWith('image/')) return true
  const lower = f.name.toLowerCase()
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function filterImageFiles(list: FileList | File[]): File[] {
  return Array.from(list).filter(isImageFile)
}

export const BulkGalleryUploader: React.FC = () => {
  const { dispatchFields } = useForm()
  const { title, gallery } = useFormFields(([fields]) => ({
    title: fields?.title?.value,
    gallery: fields?.gallery?.value,
  }))

  const [busy, setBusy] = React.useState(false)
  const [statuses, setStatuses] = React.useState<UploadStatus[]>([])
  const [dragActive, setDragActive] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const boxRef = React.useRef<HTMLDivElement>(null)
  const dragCounterRef = React.useRef(0)

  // Latest gallery/title snapshots — refs so the native event handlers
  // (which are bound once in useEffect) always see the current values
  // without us having to tear-down/re-bind on every render.
  const galleryRef = React.useRef(gallery)
  const titleRef = React.useRef(title)
  React.useEffect(() => {
    galleryRef.current = gallery
  }, [gallery])
  React.useEffect(() => {
    titleRef.current = title
  }, [title])

  const dispatchFieldsRef = React.useRef(dispatchFields)
  React.useEffect(() => {
    dispatchFieldsRef.current = dispatchFields
  }, [dispatchFields])

  const processFiles = React.useCallback(async (rawFiles: File[]) => {
    if (rawFiles.length === 0) return
    console.warn('[bulk-gallery] processFiles start', { count: rawFiles.length })

    const baseGallery: GalleryRow[] = Array.isArray(galleryRef.current)
      ? [...(galleryRef.current as GalleryRow[])]
      : []
    const titleStr = typeof titleRef.current === 'string' ? titleRef.current : ''
    const altBase = titleStr ? titleStr.slice(0, ALT_MAX_LEN) : ''

    setBusy(true)
    setStatuses(rawFiles.map((f) => ({ name: f.name, state: 'pending' })))

    const newRows: GalleryRow[] = []
    for (let i = 0; i < rawFiles.length; i++) {
      const file = rawFiles[i]
      if (!file) continue
      const alt = altBase || stripExtension(file.name).slice(0, ALT_MAX_LEN) || 'image'

      const fd = new FormData()
      fd.append('file', file)
      fd.append('_payload', JSON.stringify({ alt }))

      try {
        console.warn('[bulk-gallery] uploading', {
          name: file.name,
          size: file.size,
          type: file.type,
        })
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
            /* not JSON */
          }
          console.warn('[bulk-gallery] upload failed', {
            name: file.name,
            status: res.status,
            message,
          })
          setStatuses((prev) =>
            prev.map((s, idx) => (idx === i ? { ...s, state: 'error', message } : s)),
          )
          continue
        }
        const data = (await res.json()) as { doc?: { id?: string | number } }
        const mediaId = data?.doc?.id
        if (!mediaId) {
          console.warn('[bulk-gallery] no media id in response', { name: file.name })
          setStatuses((prev) =>
            prev.map((s, idx) =>
              idx === i ? { ...s, state: 'error', message: 'استجابة غير متوقعة' } : s,
            ),
          )
          continue
        }
        console.warn('[bulk-gallery] upload ok', { name: file.name, mediaId })
        newRows.push({ image: mediaId, caption: '' })
        setStatuses((prev) => prev.map((s, idx) => (idx === i ? { ...s, state: 'ok' } : s)))
      } catch (err) {
        console.error('[bulk-gallery] upload exception', err)
        setStatuses((prev) =>
          prev.map((s, idx) => (idx === i ? { ...s, state: 'error', message: 'فشل الاتصال' } : s)),
        )
      }
    }

    if (newRows.length > 0) {
      console.warn('[bulk-gallery] dispatchFields append', { count: newRows.length })
      dispatchFieldsRef.current({
        type: 'UPDATE',
        path: 'gallery',
        value: [...baseGallery, ...newRows],
      })
    }

    setBusy(false)
  }, [])

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    const files = filterImageFiles(fileList)
    if (inputRef.current) inputRef.current.value = ''
    console.warn('[bulk-gallery] picked via dialog', {
      picked: fileList.length,
      accepted: files.length,
    })
    if (files.length === 0) {
      setStatuses([{ name: 'لم يتم التعرّف على ملفات صور', state: 'error' }])
      return
    }
    await processFiles(files)
  }

  // Click anywhere on the box (outside the explicit button) → trigger
  // the same hidden file input. Fallback for cases where drag-and-drop
  // is blocked by another layer of the admin. Editor's first ask was
  // "select many at once" — this path always works.
  const onBoxClick = (e: React.MouseEvent) => {
    if (busy) return
    // Don't double-trigger when the click was on the button or its
    // label/input — those already drive the file picker themselves.
    const target = e.target as HTMLElement
    if (target.closest('.iram-bulk-gallery__btn')) return
    inputRef.current?.click()
  }

  // Native DOM event listeners (NOT React's synthetic ones). This is the
  // robust path: synthetic events go through React's delegated dispatch
  // at the root, and other listeners (window-level react-dnd handlers,
  // for instance) can fire first and stopPropagation. Native element
  // listeners run in real DOM order on the actual node — nothing
  // higher up can prevent them.
  React.useEffect(() => {
    const node = boxRef.current
    if (!node) return

    const onDragEnter = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounterRef.current += 1
      setDragActive(true)
      console.warn('[bulk-gallery] dragenter', { types: Array.from(e.dataTransfer?.types ?? []) })
    }
    const onDragOver = (e: DragEvent) => {
      // The only event where preventDefault is MANDATORY. Without it
      // the browser rejects the drop and falls back to navigating to
      // file://… on a local image.
      e.preventDefault()
      e.stopPropagation()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
      if (dragCounterRef.current === 0) setDragActive(false)
    }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounterRef.current = 0
      setDragActive(false)
      const fileList = e.dataTransfer?.files
      console.warn('[bulk-gallery] drop', {
        fileCount: fileList?.length ?? 0,
        types: Array.from(e.dataTransfer?.types ?? []),
      })
      if (!fileList || fileList.length === 0) return
      const files = filterImageFiles(fileList)
      console.warn('[bulk-gallery] drop filtered', {
        total: fileList.length,
        accepted: files.length,
        rejected: Array.from(fileList)
          .filter((f) => !isImageFile(f))
          .map((f) => ({ name: f.name, type: f.type, size: f.size })),
      })
      if (files.length === 0) {
        setStatuses([{ name: 'لم يتم التعرّف على ملفات صور', state: 'error' }])
        return
      }
      void processFiles(files)
    }

    node.addEventListener('dragenter', onDragEnter)
    node.addEventListener('dragover', onDragOver)
    node.addEventListener('dragleave', onDragLeave)
    node.addEventListener('drop', onDrop)
    return () => {
      node.removeEventListener('dragenter', onDragEnter)
      node.removeEventListener('dragover', onDragOver)
      node.removeEventListener('dragleave', onDragLeave)
      node.removeEventListener('drop', onDrop)
    }
  }, [processFiles])

  const pickedCount = statuses.length
  const okCount = statuses.filter((s) => s.state === 'ok').length
  const errorCount = statuses.filter((s) => s.state === 'error').length

  const containerClass = `iram-bulk-gallery${dragActive ? ' iram-bulk-gallery--drag' : ''}`

  return (
    <div
      ref={boxRef}
      className={containerClass}
      dir="rtl"
      role="button"
      tabIndex={0}
      onClick={onBoxClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
    >
      <label className="iram-bulk-gallery__btn" onClick={(e) => e.stopPropagation()}>
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
        اضغط على الصندوق لاختيار عدة صور، أو اسحبها من مجلدك وأفلتها هنا — ستضاف إلى المعرض أدناه.
        أضف التعليق لكل صورة من السطر المقابل بعد الرفع.
      </small>

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
