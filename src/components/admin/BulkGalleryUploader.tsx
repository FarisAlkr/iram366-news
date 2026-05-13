'use client'

import React from 'react'
import { useForm, useFormFields } from '@payloadcms/ui'

/**
 * Bulk multi-file uploader for the Articles gallery field.
 *
 * Two equivalent interaction modes (both feed the same upload pipeline):
 *   1. Click anywhere on the box → native OS multi-file picker opens.
 *   2. Drag files from a folder window onto the box → release → upload.
 *
 * Why this exists: the Payload `/admin` stock array UI only lets editors
 * "Add Row → pick one file" per image. Mobile `/m/new` had multi-pick
 * built into its server action from day one. This component restores
 * desktop parity.
 *
 * Error reporting is the focus of this iteration. Earlier versions
 * silently swallowed server rejections (the dominant case: the editor
 * drags a HEIC from iPhoto, my client lets it through, the server
 * Media collection rejects it because its allowlist is jpeg/png/webp/
 * avif/svg only → editor sees a vague "فشل الرفع" and gives up).
 *
 * Now we surface for every failed file:
 *   - what happened (specific Arabic message)
 *   - why (HTTP status + server message when available)
 *   - what to do next (re-encode, re-login, smaller file, …)
 *   - a "copy diagnostic" button to paste back to support
 *
 * Drag handlers use native addEventListener (not React synthetic events)
 * to bypass Payload admin's react-dnd HTML5Backend which can intercept
 * file drops at the window level. stopPropagation on the drop keeps
 * react-dnd from seeing it.
 */

// =============================================================================
// Server contract — MUST match Media collection
// (src/payload/collections/Media.ts: `upload.mimeTypes`)
// =============================================================================
// If you add a MIME here, also add it on the server side; if you add one
// on the server, mirror it here. Drift between client and server is what
// produced the "silent rejection" bug this iteration fixes.
const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/svg+xml',
] as const

// Filename extensions that map onto ALLOWED_MIME. Used as a fallback
// when File.type is empty (some drag sources don't set MIME). If both
// MIME and extension fail, the file is rejected client-side with a
// specific "نوع الملف غير مدعوم" message — no server roundtrip needed.
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.avif', '.svg'] as const

// Soft limit — files above this get a pre-flight warning chip. Server
// can usually handle them but they take a while and may time out on
// slow connections. (Payload's default body limit is generous but not
// infinite; tune if the server starts 413-ing.)
const SOFT_SIZE_BYTES = 8 * 1024 * 1024 // 8 MB
const HARD_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB

const ALT_MAX_LEN = 120

// =============================================================================
// Types
// =============================================================================
type GalleryRow = {
  image?: string | number | { id: string | number } | null
  caption?: string | null
  id?: string
}

type ErrorKind =
  | 'mime' // file type not supported
  | 'empty' // 0-byte file
  | 'too-big' // exceeds HARD_SIZE_BYTES
  | 'auth' // 401
  | 'permission' // 403
  | 'too-large-server' // 413
  | 'unsupported-server' // 415
  | 'validation' // 422
  | 'rate-limit' // 429
  | 'server' // 5xx
  | 'parse' // non-JSON response
  | 'network' // fetch threw
  | 'unknown-success-shape' // 2xx but no doc.id
  | 'no-image-files' // pre-flight: nothing passed the filter

interface UploadStatus {
  name: string
  state: 'pending' | 'ok' | 'error'
  // Human-readable Arabic explanation shown on the chip.
  message?: string
  // Diagnostic context for "copy diagnostic" button.
  diag?: {
    kind: ErrorKind
    mime?: string
    sizeBytes?: number
    httpStatus?: number
    serverMessage?: string
  }
}

// =============================================================================
// Helpers
// =============================================================================
function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot).toLowerCase() : ''
}

function isLikelyImageByName(name: string): boolean {
  const ext = fileExtension(name)
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext)
}

function isAllowedMime(mime: string | undefined | null): boolean {
  if (!mime) return false
  return (ALLOWED_MIME as readonly string[]).includes(mime)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Map server error responses into the categorized {kind, message} shape.
// Each branch is a separate Arabic sentence with what + why + next step.
function categorizeHttpError(
  status: number,
  serverMessage: string | undefined,
  file: File,
): { kind: ErrorKind; message: string } {
  if (status === 401) {
    return {
      kind: 'auth',
      message:
        'انتهت جلسة الدخول. أعد تسجيل الدخول من نافذة جديدة، ثم عد إلى هذه الصفحة وأعد المحاولة.',
    }
  }
  if (status === 403) {
    return {
      kind: 'permission',
      message: 'ليس لديك صلاحية لرفع الوسائط — تواصل مع مدير النظام لرفع صلاحيات حسابك.',
    }
  }
  if (status === 413) {
    return {
      kind: 'too-large-server',
      message: `الخادم يرفض الملف لأنه كبير (${formatBytes(file.size)}). جرّب ضغط الصورة أو تصغيرها قبل الرفع.`,
    }
  }
  if (status === 415) {
    return {
      kind: 'unsupported-server',
      message: `الخادم رفض نوع الملف ${file.type || 'غير محدد'}. الأنواع المدعومة: JPG، PNG، WEBP، AVIF، SVG.`,
    }
  }
  if (status === 422) {
    const detail = serverMessage ? ` — ${serverMessage}` : ''
    return {
      kind: 'validation',
      message: `الخادم رفض البيانات${detail}. قد يكون الملف تالفاً أو ينقصه حقل مطلوب.`,
    }
  }
  if (status === 429) {
    return {
      kind: 'rate-limit',
      message: 'محاولات كثيرة بسرعة — انتظر دقيقة ثم أعد المحاولة.',
    }
  }
  if (status >= 500) {
    return {
      kind: 'server',
      message: `خطأ في الخادم (${status}). أعد المحاولة بعد قليل، فإن استمر بلّغ المدير.`,
    }
  }
  // Generic non-2xx fallback
  const detail = serverMessage ? `: ${serverMessage}` : ''
  return {
    kind: 'server',
    message: `فشل الرفع (HTTP ${status})${detail}`,
  }
}

function buildDiagnostic(s: UploadStatus): string {
  const parts: string[] = []
  parts.push(`[bulk-gallery diagnostic]`)
  parts.push(`file: ${s.name}`)
  if (s.diag) {
    parts.push(`kind: ${s.diag.kind}`)
    if (s.diag.mime !== undefined) parts.push(`mime: ${s.diag.mime || '(empty)'}`)
    if (s.diag.sizeBytes !== undefined) parts.push(`size: ${formatBytes(s.diag.sizeBytes)}`)
    if (s.diag.httpStatus !== undefined) parts.push(`http: ${s.diag.httpStatus}`)
    if (s.diag.serverMessage) parts.push(`server: ${s.diag.serverMessage}`)
  }
  if (s.message) parts.push(`shown: ${s.message}`)
  return parts.join('\n')
}

// =============================================================================
// Component
// =============================================================================
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
  // bound once in useEffect always see current values without re-bind.
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

  // ---------------------------------------------------------------------------
  // Pre-flight — classify every picked file BEFORE any network round-trip.
  // Returns: { ok: File[] to upload, errors: UploadStatus[] to display }.
  // ---------------------------------------------------------------------------
  const preflightFiles = React.useCallback(
    (
      raw: File[],
    ): {
      ok: File[]
      errors: UploadStatus[]
    } => {
      const ok: File[] = []
      const errors: UploadStatus[] = []

      for (const f of raw) {
        // Empty file
        if (f.size <= 0) {
          errors.push({
            name: f.name,
            state: 'error',
            message: 'الملف فارغ (0 بايت). قد يكون تالفاً أو لم يكتمل تحميله.',
            diag: { kind: 'empty', mime: f.type, sizeBytes: f.size },
          })
          continue
        }

        // Hard size limit
        if (f.size > HARD_SIZE_BYTES) {
          errors.push({
            name: f.name,
            state: 'error',
            message: `الملف أكبر من الحد المسموح به محلياً (${formatBytes(f.size)} > ${formatBytes(HARD_SIZE_BYTES)}). صغّر الصورة قبل الرفع.`,
            diag: { kind: 'too-big', mime: f.type, sizeBytes: f.size },
          })
          continue
        }

        // Type allowlist — MIME first, extension fallback
        const mimeOk = isAllowedMime(f.type)
        const extOk = isLikelyImageByName(f.name)
        if (!mimeOk && !extOk) {
          const detected = f.type || fileExtension(f.name) || 'غير محدد'
          errors.push({
            name: f.name,
            state: 'error',
            message: `نوع الملف غير مدعوم (${detected}). تُقبل: JPG، PNG، WEBP، AVIF، SVG. للصور من iPhone (HEIC) صدّرها كـ JPG أولاً.`,
            diag: { kind: 'mime', mime: f.type, sizeBytes: f.size },
          })
          continue
        }

        ok.push(f)
      }

      return { ok, errors }
    },
    [],
  )

  const processFiles = React.useCallback(
    async (rawFiles: File[]) => {
      if (rawFiles.length === 0) return

      const { ok: filesToUpload, errors: preflightErrors } = preflightFiles(rawFiles)

      // Seed status list with both the pending uploads AND the pre-flight
      // rejections, so the editor sees the whole picture immediately.
      const initial: UploadStatus[] = [
        ...filesToUpload.map((f) => ({ name: f.name, state: 'pending' as const })),
        ...preflightErrors,
      ]
      setStatuses(initial)

      if (filesToUpload.length === 0) {
        // Everything was rejected before upload — surface and stop.
        return
      }

      const baseGallery: GalleryRow[] = Array.isArray(galleryRef.current)
        ? [...(galleryRef.current as GalleryRow[])]
        : []
      const titleStr = typeof titleRef.current === 'string' ? titleRef.current : ''
      const altBase = titleStr ? titleStr.slice(0, ALT_MAX_LEN) : ''

      setBusy(true)

      const newRows: GalleryRow[] = []
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i]
        if (!file) continue
        const alt = altBase || stripExtension(file.name).slice(0, ALT_MAX_LEN) || 'image'

        const fd = new FormData()
        fd.append('file', file)
        fd.append('_payload', JSON.stringify({ alt }))

        // Soft size warning for slow uploads — not an error, but shows
        // the editor why a single file is taking a while.
        const isLarge = file.size > SOFT_SIZE_BYTES
        if (isLarge) {
          setStatuses((prev) =>
            prev.map((s, idx) =>
              idx === i
                ? { ...s, message: `جاري الرفع — ${formatBytes(file.size)} (قد يستغرق وقتاً)` }
                : s,
            ),
          )
        }

        try {
          const res = await fetch('/api/media', {
            method: 'POST',
            body: fd,
            credentials: 'include',
          })

          if (!res.ok) {
            // Pull a server message if there is one. Payload returns
            // `{ errors: [{ message }] }` on validation/MIME errors.
            let serverMessage: string | undefined
            const ct = res.headers.get('content-type') ?? ''
            try {
              if (ct.includes('application/json')) {
                const body = (await res.json()) as { errors?: { message?: string }[] }
                serverMessage = body?.errors?.[0]?.message
              } else {
                // Non-JSON response (HTML error page from Caddy/Next, plain text)
                const text = (await res.text()).slice(0, 200)
                if (text.trim()) serverMessage = text
              }
            } catch {
              /* swallow parse error — categorizeHttpError handles undefined */
            }

            const { kind, message } = categorizeHttpError(res.status, serverMessage, file)
            setStatuses((prev) =>
              prev.map((s, idx) =>
                idx === i
                  ? {
                      ...s,
                      state: 'error',
                      message,
                      diag: {
                        kind,
                        mime: file.type,
                        sizeBytes: file.size,
                        httpStatus: res.status,
                        serverMessage,
                      },
                    }
                  : s,
              ),
            )
            continue
          }

          // 2xx — verify shape before trusting it.
          let mediaId: string | number | undefined
          try {
            const data = (await res.json()) as { doc?: { id?: string | number } }
            mediaId = data?.doc?.id
          } catch (parseErr) {
            setStatuses((prev) =>
              prev.map((s, idx) =>
                idx === i
                  ? {
                      ...s,
                      state: 'error',
                      message:
                        'الخادم أعاد استجابة غير قابلة للقراءة (ليست JSON). أعد المحاولة وإن استمر بلّغ المدير.',
                      diag: {
                        kind: 'parse',
                        mime: file.type,
                        sizeBytes: file.size,
                        httpStatus: res.status,
                        serverMessage: parseErr instanceof Error ? parseErr.message : undefined,
                      },
                    }
                  : s,
              ),
            )
            continue
          }

          if (!mediaId) {
            setStatuses((prev) =>
              prev.map((s, idx) =>
                idx === i
                  ? {
                      ...s,
                      state: 'error',
                      message:
                        'الرفع نجح لكن الخادم لم يُعد معرّف الصورة — أعد المحاولة، فإن استمر بلّغ المدير.',
                      diag: {
                        kind: 'unknown-success-shape',
                        mime: file.type,
                        sizeBytes: file.size,
                        httpStatus: res.status,
                      },
                    }
                  : s,
              ),
            )
            continue
          }

          newRows.push({ image: mediaId, caption: '' })
          setStatuses((prev) =>
            prev.map((s, idx) =>
              idx === i ? { ...s, state: 'ok', message: 'تم الرفع', diag: undefined } : s,
            ),
          )
        } catch (err) {
          // fetch() threw — usually offline, DNS, CORS, or aborted request.
          const errMsg = err instanceof Error ? err.message : String(err)
          setStatuses((prev) =>
            prev.map((s, idx) =>
              idx === i
                ? {
                    ...s,
                    state: 'error',
                    message:
                      'تعذّر الاتصال بالخادم. تحقق من اتصال الإنترنت ثم أعد المحاولة. إن كنت متصلاً، أعد تحميل الصفحة.',
                    diag: {
                      kind: 'network',
                      mime: file.type,
                      sizeBytes: file.size,
                      serverMessage: errMsg,
                    },
                  }
                : s,
            ),
          )
        }
      }

      // One bulk dispatch at the end for all newly-attached rows. Pushing
      // one-at-a-time would re-render the array editor N times and lose
      // any in-flight caption edits the editor might be doing.
      if (newRows.length > 0) {
        dispatchFieldsRef.current({
          type: 'UPDATE',
          path: 'gallery',
          value: [...baseGallery, ...newRows],
        })
      }

      setBusy(false)
    },
    [preflightFiles],
  )

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    if (inputRef.current) inputRef.current.value = ''
    await processFiles(files)
  }

  // Click anywhere on the box (outside the explicit button) → trigger
  // the hidden file input. Always-works fallback in case drag-and-drop
  // is blocked by another admin layer.
  const onBoxClick = (e: React.MouseEvent) => {
    if (busy) return
    const target = e.target as HTMLElement
    if (target.closest('.iram-bulk-gallery__btn')) return
    // If the click was inside an error chip's copy button, also skip.
    if (target.closest('.iram-bulk-gallery__copy')) return
    inputRef.current?.click()
  }

  // Native DOM event listeners (not React synthetic) — bypasses any
  // window-level interceptors (react-dnd) that could swallow file drops.
  React.useEffect(() => {
    const node = boxRef.current
    if (!node) return

    const onDragEnter = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounterRef.current += 1
      setDragActive(true)
    }
    const onDragOver = (e: DragEvent) => {
      // MANDATORY — without preventDefault on dragover the browser
      // refuses the drop and navigates to file://… on a local image.
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
      if (!fileList || fileList.length === 0) return
      void processFiles(Array.from(fileList))
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

  const copyDiagnostic = async (s: UploadStatus) => {
    const text = buildDiagnostic(s)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // clipboard API blocked (e.g. insecure context) — open a prompt
      // so the editor can copy manually.
      window.prompt('انسخ النص أدناه لإرساله إلى المدير:', text)
    }
  }

  const pickedCount = statuses.length
  const okCount = statuses.filter((s) => s.state === 'ok').length
  const errorCount = statuses.filter((s) => s.state === 'error').length
  const pendingCount = statuses.filter((s) => s.state === 'pending').length
  const errors = statuses.filter((s) => s.state === 'error')

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
          accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
          multiple
          onChange={onPick}
          disabled={busy}
          aria-label="رفع عدة صور للمعرض"
        />
      </label>

      <small className="iram-bulk-gallery__hint">
        اضغط على الصندوق لاختيار عدة صور، أو اسحبها من مجلدك وأفلتها هنا. الأنواع المدعومة: JPG،
        PNG، WEBP، AVIF، SVG. الحدّ الأقصى لحجم الصورة: {formatBytes(HARD_SIZE_BYTES)}.
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
              {okCount + errorCount} من {pickedCount} اكتمل
              {pendingCount > 0 ? ` — ${pendingCount} متبقّية` : ''}
            </span>
          ) : (
            <span>
              {okCount > 0 && (
                <>
                  تم رفع {okCount} من {pickedCount}
                </>
              )}
              {okCount > 0 && errorCount > 0 ? ' — ' : ''}
              {errorCount > 0 && <>فشلت {errorCount}</>}
              {okCount === 0 && errorCount === pickedCount && 'لم يتم رفع أي ملف'}
            </span>
          )}

          {errors.length > 0 && (
            <ul className="iram-bulk-gallery__errors">
              {errors.map((s, idx) => (
                <li key={idx} className="iram-bulk-gallery__error">
                  <div className="iram-bulk-gallery__error-head">
                    <strong>{s.name}</strong>
                    {s.diag?.httpStatus !== undefined && (
                      <span className="iram-bulk-gallery__error-code">
                        HTTP {s.diag.httpStatus}
                      </span>
                    )}
                  </div>
                  {s.message && <div className="iram-bulk-gallery__error-msg">{s.message}</div>}
                  <div className="iram-bulk-gallery__error-meta">
                    {s.diag?.sizeBytes !== undefined && (
                      <span>الحجم: {formatBytes(s.diag.sizeBytes)}</span>
                    )}
                    {s.diag?.mime !== undefined && (
                      <span>النوع: {s.diag.mime || '(غير محدد)'}</span>
                    )}
                    <button
                      type="button"
                      className="iram-bulk-gallery__copy"
                      onClick={(e) => {
                        e.stopPropagation()
                        void copyDiagnostic(s)
                      }}
                    >
                      نسخ التفاصيل التقنية
                    </button>
                  </div>
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
