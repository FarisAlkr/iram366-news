'use client'

import React from 'react'
import { useForm, useFormFields } from '@payloadcms/ui'

/**
 * Bulk multi-file uploader for the Articles gallery field.
 *
 * UI model — "asset drop area":
 *
 *   Idle state:
 *     A clean drop zone with a refined illustration, headline, and
 *     supported-formats line. No emoji button, no aggressive gold
 *     borders — soft white surface with a subtle navy hairline.
 *
 *   Files picked → tile grid:
 *     Each picked file becomes a 140×140 preview tile (rendered from
 *     a local Object URL the moment the file is picked, no waiting
 *     for the server). Status is PAINTED ON the tile:
 *       - PENDING: thumbnail visible, dim overlay
 *       - UPLOADING: thumbnail visible, soft shimmer overlay
 *       - SUCCESS: thumbnail visible, green check badge top-corner
 *       - ERROR: thumbnail visible, red X badge, click expands the
 *                detailed error message + "نسخ التفاصيل التقنية"
 *
 *   Banner above the grid:
 *     Live count during upload ("3 من 5 رُفعت بنجاح"). When the batch
 *     finishes successfully it flips to a green confirmation banner
 *     "✓ تم رفع 5 صور بنجاح — أُضيفت إلى المعرض أدناه" so the editor
 *     SEES the completion. If anything failed, an amber banner shows
 *     "تم رفع N، فشل M" with the failing tiles already marked.
 *
 * Drag-and-drop uses native DOM listeners (not React synthetic events)
 * to bypass Payload admin's react-dnd HTML5Backend.
 *
 * Server-side contract: the file allowlist here MUST match the Media
 * collection's `upload.mimeTypes` exactly (jpeg/png/webp/avif/svg).
 * Drift between client and server produces silent rejections.
 */

// =============================================================================
// Constants
// =============================================================================
const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/svg+xml',
] as const

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.avif', '.svg'] as const

const SOFT_SIZE_BYTES = 8 * 1024 * 1024 // 8 MB — warn the editor a single file may be slow
const HARD_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB — reject client-side

const ALT_MAX_LEN = 120

// =============================================================================
// Types
// =============================================================================
type GalleryRow = {
  image?: string | number | { id: string | number } | null
  caption?: string | null
  id?: string
}

type TileState = 'pending' | 'uploading' | 'success' | 'error'

type ErrorKind =
  | 'mime'
  | 'empty'
  | 'too-big'
  | 'auth'
  | 'permission'
  | 'too-large-server'
  | 'unsupported-server'
  | 'validation'
  | 'rate-limit'
  | 'server'
  | 'parse'
  | 'network'
  | 'unknown-success-shape'

interface Tile {
  // Stable id for React keys — generated on add, never reused.
  id: string
  file: File
  // blob: URL created with URL.createObjectURL — used for the preview
  // image. MUST be revoked on tile removal / unmount or memory leaks.
  previewUrl: string
  state: TileState
  // For error tiles only.
  errorMessage?: string
  errorKind?: ErrorKind
  httpStatus?: number
  serverMessage?: string
  // For success tiles — the media id returned by Payload, so the
  // dispatched gallery row points at the right media doc.
  mediaId?: string | number
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
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(fileExtension(name))
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

function truncateName(name: string, max = 22): string {
  if (name.length <= max) return name
  const ext = fileExtension(name)
  const head = stripExtension(name).slice(0, max - ext.length - 1)
  return `${head}…${ext}`
}

function newTileId(): string {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// Map a server response error onto a categorized message. Used to
// populate the per-tile error overlay AND the diagnostic block.
function categorizeHttpError(
  status: number,
  serverMessage: string | undefined,
  file: File,
): { kind: ErrorKind; message: string } {
  if (status === 401) {
    return {
      kind: 'auth',
      message: 'انتهت جلسة الدخول. أعد تسجيل الدخول ثم حاول مجدداً.',
    }
  }
  if (status === 403) {
    return {
      kind: 'permission',
      message: 'ليس لديك صلاحية لرفع الوسائط. تواصل مع مدير النظام.',
    }
  }
  if (status === 413) {
    return {
      kind: 'too-large-server',
      message: `الخادم رفض الملف (${formatBytes(file.size)}). صغّر الصورة قبل المحاولة.`,
    }
  }
  if (status === 415) {
    return {
      kind: 'unsupported-server',
      message: `نوع الملف ${file.type || 'غير محدد'} غير مدعوم. الأنواع المدعومة: JPG, PNG, WEBP, AVIF, SVG.`,
    }
  }
  if (status === 422) {
    const detail = serverMessage ? ` — ${serverMessage}` : ''
    return {
      kind: 'validation',
      message: `الخادم رفض البيانات${detail}.`,
    }
  }
  if (status === 429) {
    return { kind: 'rate-limit', message: 'محاولات كثيرة بسرعة. انتظر دقيقة وأعد المحاولة.' }
  }
  if (status >= 500) {
    return {
      kind: 'server',
      message: `خطأ في الخادم (${status}). أعد المحاولة بعد قليل.`,
    }
  }
  const detail = serverMessage ? `: ${serverMessage}` : ''
  return { kind: 'server', message: `فشل الرفع (HTTP ${status})${detail}` }
}

function buildDiagnostic(t: Tile): string {
  const parts: string[] = [
    `[bulk-gallery diagnostic]`,
    `file: ${t.file.name}`,
    `size: ${formatBytes(t.file.size)}`,
    `mime: ${t.file.type || '(empty)'}`,
    `state: ${t.state}`,
  ]
  if (t.errorKind) parts.push(`kind: ${t.errorKind}`)
  if (t.httpStatus !== undefined) parts.push(`http: ${t.httpStatus}`)
  if (t.serverMessage) parts.push(`server: ${t.serverMessage}`)
  if (t.errorMessage) parts.push(`shown: ${t.errorMessage}`)
  return parts.join('\n')
}

// =============================================================================
// Drop-zone illustration — inline SVG, no external assets
// =============================================================================
const DropIllustration: React.FC = () => (
  <svg
    width="56"
    height="56"
    viewBox="0 0 56 56"
    fill="none"
    aria-hidden="true"
    className="iram-bgu__icon"
  >
    <rect x="4" y="10" width="48" height="36" rx="6" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="18" cy="22" r="3.5" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="M4 38l12-12 12 12 6-6 18 18"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <path d="M40 6v12M34 12h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

// =============================================================================
// Component
// =============================================================================
export const BulkGalleryUploader: React.FC = () => {
  const { dispatchFields } = useForm()
  const { title, gallery } = useFormFields(([fields]) => ({
    title: fields?.title?.value,
    gallery: fields?.gallery?.value,
  }))

  const [tiles, setTiles] = React.useState<Tile[]>([])
  const [dragActive, setDragActive] = React.useState(false)
  // ID of the tile whose error panel is expanded (one at a time).
  const [expandedError, setExpandedError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const boxRef = React.useRef<HTMLDivElement>(null)
  const dragCounterRef = React.useRef(0)

  // Latest gallery/title snapshots in refs — the upload pipeline reads
  // these inside the long-lived async loop so it always sees current
  // values without us tearing down listeners.
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

  // Revoke any in-flight Object URLs when the component unmounts to
  // prevent memory leaks on a long admin session.
  React.useEffect(() => {
    return () => {
      tiles.forEach((t) => {
        if (t.previewUrl) URL.revokeObjectURL(t.previewUrl)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // Pre-flight — classify a file before allocating an Object URL or
  // pushing it as a pending tile. Returns the rejection tile when bad.
  // ---------------------------------------------------------------------------
  const preflight = React.useCallback(
    (f: File): { ok: true } | { ok: false; kind: ErrorKind; message: string } => {
      if (f.size <= 0) {
        return {
          ok: false,
          kind: 'empty',
          message: 'الملف فارغ (0 بايت). قد يكون تالفاً.',
        }
      }
      if (f.size > HARD_SIZE_BYTES) {
        return {
          ok: false,
          kind: 'too-big',
          message: `الملف أكبر من ${formatBytes(HARD_SIZE_BYTES)} (${formatBytes(f.size)}). صغّره أولاً.`,
        }
      }
      const mimeOk = isAllowedMime(f.type)
      const extOk = isLikelyImageByName(f.name)
      if (!mimeOk && !extOk) {
        const detected = f.type || fileExtension(f.name) || 'غير محدد'
        return {
          ok: false,
          kind: 'mime',
          message: `نوع غير مدعوم (${detected}). الأنواع المسموحة: JPG, PNG, WEBP, AVIF, SVG. صور iPhone (HEIC) صدّرها كـ JPG أولاً.`,
        }
      }
      return { ok: true }
    },
    [],
  )

  // ---------------------------------------------------------------------------
  // Process a batch of newly picked / dropped files.
  // ---------------------------------------------------------------------------
  const processFiles = React.useCallback(
    async (rawFiles: File[]) => {
      if (rawFiles.length === 0) return

      // Build initial tiles synchronously so the preview grid appears
      // immediately while uploads run in the background. Bad files get
      // pushed as 'error' tiles right away — same UI as failed uploads.
      const newTiles: Tile[] = rawFiles.map((file) => {
        const pf = preflight(file)
        const previewUrl = URL.createObjectURL(file)
        if (pf.ok) {
          return {
            id: newTileId(),
            file,
            previewUrl,
            state: 'pending',
          }
        }
        return {
          id: newTileId(),
          file,
          previewUrl,
          state: 'error',
          errorMessage: pf.message,
          errorKind: pf.kind,
        }
      })

      setTiles((prev) => [...prev, ...newTiles])

      // Pull title + gallery snapshot for upload context.
      const baseGallery: GalleryRow[] = Array.isArray(galleryRef.current)
        ? [...(galleryRef.current as GalleryRow[])]
        : []
      const titleStr = typeof titleRef.current === 'string' ? titleRef.current : ''
      const altBase = titleStr ? titleStr.slice(0, ALT_MAX_LEN) : ''

      const successfullyUploaded: GalleryRow[] = []

      // Upload one at a time. Parallel would be faster, but a slow
      // network × a 10-file batch could OOM the browser; serial gives
      // each tile a clear pending → uploading → success/error path.
      for (const tile of newTiles) {
        if (tile.state === 'error') continue // skipped by pre-flight

        // Mark tile as uploading.
        setTiles((prev) => prev.map((t) => (t.id === tile.id ? { ...t, state: 'uploading' } : t)))

        const alt = altBase || stripExtension(tile.file.name).slice(0, ALT_MAX_LEN) || 'image'
        const fd = new FormData()
        fd.append('file', tile.file)
        fd.append('_payload', JSON.stringify({ alt }))

        try {
          const res = await fetch('/api/media', {
            method: 'POST',
            body: fd,
            credentials: 'include',
          })

          if (!res.ok) {
            let serverMessage: string | undefined
            const ct = res.headers.get('content-type') ?? ''
            try {
              if (ct.includes('application/json')) {
                const body = (await res.json()) as { errors?: { message?: string }[] }
                serverMessage = body?.errors?.[0]?.message
              } else {
                const text = (await res.text()).slice(0, 200)
                if (text.trim()) serverMessage = text
              }
            } catch {
              /* fall through */
            }
            const { kind, message } = categorizeHttpError(res.status, serverMessage, tile.file)
            setTiles((prev) =>
              prev.map((t) =>
                t.id === tile.id
                  ? {
                      ...t,
                      state: 'error',
                      errorMessage: message,
                      errorKind: kind,
                      httpStatus: res.status,
                      serverMessage,
                    }
                  : t,
              ),
            )
            continue
          }

          let mediaId: string | number | undefined
          try {
            const data = (await res.json()) as { doc?: { id?: string | number } }
            mediaId = data?.doc?.id
          } catch (parseErr) {
            setTiles((prev) =>
              prev.map((t) =>
                t.id === tile.id
                  ? {
                      ...t,
                      state: 'error',
                      errorMessage: 'استجابة الخادم غير قابلة للقراءة. أعد المحاولة.',
                      errorKind: 'parse',
                      httpStatus: res.status,
                      serverMessage: parseErr instanceof Error ? parseErr.message : undefined,
                    }
                  : t,
              ),
            )
            continue
          }

          if (!mediaId) {
            setTiles((prev) =>
              prev.map((t) =>
                t.id === tile.id
                  ? {
                      ...t,
                      state: 'error',
                      errorMessage: 'الرفع نجح لكن لم يُعد معرّف الصورة.',
                      errorKind: 'unknown-success-shape',
                      httpStatus: res.status,
                    }
                  : t,
              ),
            )
            continue
          }

          setTiles((prev) =>
            prev.map((t) => (t.id === tile.id ? { ...t, state: 'success', mediaId } : t)),
          )
          successfullyUploaded.push({ image: mediaId, caption: '' })
        } catch (err) {
          setTiles((prev) =>
            prev.map((t) =>
              t.id === tile.id
                ? {
                    ...t,
                    state: 'error',
                    errorMessage: 'تعذّر الاتصال بالخادم. تحقق من الإنترنت وأعد المحاولة.',
                    errorKind: 'network',
                    serverMessage: err instanceof Error ? err.message : String(err),
                  }
                : t,
            ),
          )
        }
      }

      // One bulk dispatch at the end — appends every successful upload
      // to the existing gallery array. Re-reads galleryRef.current at
      // dispatch time in case the editor was editing rows below while
      // the uploads ran.
      if (successfullyUploaded.length > 0) {
        const currentGallery: GalleryRow[] = Array.isArray(galleryRef.current)
          ? [...(galleryRef.current as GalleryRow[])]
          : baseGallery
        dispatchFieldsRef.current({
          type: 'UPDATE',
          path: 'gallery',
          value: [...currentGallery, ...successfullyUploaded],
        })
      }
    },
    [preflight],
  )

  // ---------------------------------------------------------------------------
  // Input + drag handlers
  // ---------------------------------------------------------------------------
  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    if (inputRef.current) inputRef.current.value = ''
    await processFiles(files)
  }

  const openPicker = React.useCallback(() => {
    if (!inputRef.current) return
    inputRef.current.click()
  }, [])

  // Native DOM listeners for drag/drop — survives any window-level
  // event interception (react-dnd HTML5Backend in Payload's admin).
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
      // MANDATORY — without this the browser refuses the drop.
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
      const fl = e.dataTransfer?.files
      if (!fl || fl.length === 0) return
      void processFiles(Array.from(fl))
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

  // ---------------------------------------------------------------------------
  // Tile actions
  // ---------------------------------------------------------------------------
  const removeTile = (id: string) => {
    setTiles((prev) => {
      const t = prev.find((x) => x.id === id)
      if (t?.previewUrl) URL.revokeObjectURL(t.previewUrl)
      return prev.filter((x) => x.id !== id)
    })
    if (expandedError === id) setExpandedError(null)
  }

  const clearAll = () => {
    tiles.forEach((t) => {
      if (t.previewUrl) URL.revokeObjectURL(t.previewUrl)
    })
    setTiles([])
    setExpandedError(null)
  }

  const retryTile = async (id: string) => {
    const t = tiles.find((x) => x.id === id)
    if (!t) return
    // Reset to pending and re-run a single-item batch. processFiles
    // doesn't know about retry semantics so we directly re-run the
    // upload-only path inline.
    setTiles((prev) =>
      prev.map((x) =>
        x.id === id
          ? {
              ...x,
              state: 'uploading',
              errorMessage: undefined,
              errorKind: undefined,
              httpStatus: undefined,
              serverMessage: undefined,
            }
          : x,
      ),
    )
    setExpandedError(null)

    const titleStr = typeof titleRef.current === 'string' ? titleRef.current : ''
    const altBase = titleStr ? titleStr.slice(0, ALT_MAX_LEN) : ''
    const alt = altBase || stripExtension(t.file.name).slice(0, ALT_MAX_LEN) || 'image'
    const fd = new FormData()
    fd.append('file', t.file)
    fd.append('_payload', JSON.stringify({ alt }))

    try {
      const res = await fetch('/api/media', { method: 'POST', body: fd, credentials: 'include' })
      if (!res.ok) {
        let serverMessage: string | undefined
        try {
          const body = (await res.json()) as { errors?: { message?: string }[] }
          serverMessage = body?.errors?.[0]?.message
        } catch {
          /* */
        }
        const { kind, message } = categorizeHttpError(res.status, serverMessage, t.file)
        setTiles((prev) =>
          prev.map((x) =>
            x.id === id
              ? {
                  ...x,
                  state: 'error',
                  errorMessage: message,
                  errorKind: kind,
                  httpStatus: res.status,
                  serverMessage,
                }
              : x,
          ),
        )
        return
      }
      const data = (await res.json()) as { doc?: { id?: string | number } }
      const mediaId = data?.doc?.id
      if (!mediaId) {
        setTiles((prev) =>
          prev.map((x) =>
            x.id === id
              ? {
                  ...x,
                  state: 'error',
                  errorMessage: 'الرفع نجح لكن لم يُعد معرّف الصورة.',
                  errorKind: 'unknown-success-shape',
                  httpStatus: res.status,
                }
              : x,
          ),
        )
        return
      }
      setTiles((prev) => prev.map((x) => (x.id === id ? { ...x, state: 'success', mediaId } : x)))
      // Append the retried upload to the gallery field too.
      const currentGallery: GalleryRow[] = Array.isArray(galleryRef.current)
        ? [...(galleryRef.current as GalleryRow[])]
        : []
      dispatchFieldsRef.current({
        type: 'UPDATE',
        path: 'gallery',
        value: [...currentGallery, { image: mediaId, caption: '' }],
      })
    } catch (err) {
      setTiles((prev) =>
        prev.map((x) =>
          x.id === id
            ? {
                ...x,
                state: 'error',
                errorMessage: 'تعذّر الاتصال. أعد المحاولة.',
                errorKind: 'network',
                serverMessage: err instanceof Error ? err.message : String(err),
              }
            : x,
        ),
      )
    }
  }

  const copyDiagnostic = async (t: Tile) => {
    const text = buildDiagnostic(t)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      window.prompt('انسخ النص أدناه:', text)
    }
  }

  // ---------------------------------------------------------------------------
  // Derived stats
  // ---------------------------------------------------------------------------
  const counts = React.useMemo(() => {
    let pending = 0
    let uploading = 0
    let success = 0
    let error = 0
    for (const t of tiles) {
      if (t.state === 'pending') pending++
      else if (t.state === 'uploading') uploading++
      else if (t.state === 'success') success++
      else error++
    }
    return { pending, uploading, success, error, total: tiles.length }
  }, [tiles])

  const isBusy = counts.pending > 0 || counts.uploading > 0
  const hasTiles = counts.total > 0
  const allDone = hasTiles && !isBusy

  return (
    <div
      ref={boxRef}
      className={`iram-bgu${dragActive ? 'iram-bgu--drag' : ''}${hasTiles ? 'iram-bgu--has-tiles' : ''}`}
      dir="rtl"
    >
      {/* Hidden file input — programmatically triggered by the drop
          zone, the picker button, and the "+ add more" tile. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
        multiple
        onChange={onPick}
        aria-label="رفع عدة صور للمعرض"
        className="iram-bgu__file"
      />

      {/* Drop zone — visible always; collapses to a slim strip when
          tiles are present so the grid takes the visual focus. */}
      <button
        type="button"
        className="iram-bgu__zone"
        onClick={openPicker}
        aria-label={hasTiles ? 'إضافة المزيد من الصور' : 'اختيار صور لرفعها'}
      >
        <div className="iram-bgu__zone-inner">
          {!hasTiles && <DropIllustration />}
          <div className="iram-bgu__zone-text">
            <strong className="iram-bgu__zone-title">
              {hasTiles ? 'إضافة المزيد من الصور' : 'اسحب الصور هنا أو اضغط للاختيار'}
            </strong>
            {!hasTiles && (
              <span className="iram-bgu__zone-sub">
                JPG · PNG · WEBP · AVIF · SVG — حتى {formatBytes(HARD_SIZE_BYTES)} لكل صورة
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Drop overlay during drag */}
      {dragActive && (
        <div className="iram-bgu__drop-overlay" aria-hidden>
          <DropIllustration />
          <span>أفلت الصور هنا</span>
        </div>
      )}

      {hasTiles && (
        <>
          {/* Banner — live counts during upload, success/partial-success when done */}
          <div
            className={`iram-bgu__banner${
              allDone && counts.error === 0
                ? 'iram-bgu__banner--success'
                : allDone && counts.error > 0
                  ? 'iram-bgu__banner--partial'
                  : ''
            }`}
            role="status"
            aria-live="polite"
          >
            <div className="iram-bgu__banner-text">
              {isBusy ? (
                <>
                  <span className="iram-bgu__banner-spinner" aria-hidden />
                  <span>
                    جاري الرفع — {counts.success + counts.error} من {counts.total}
                  </span>
                </>
              ) : counts.error === 0 ? (
                <>
                  <span className="iram-bgu__banner-check" aria-hidden>
                    ✓
                  </span>
                  <span>
                    تم رفع <strong>{counts.success}</strong> {counts.success === 1 ? 'صورة' : 'صور'}{' '}
                    بنجاح — أُضيفت إلى المعرض أدناه
                  </span>
                </>
              ) : (
                <>
                  <span className="iram-bgu__banner-warn" aria-hidden>
                    !
                  </span>
                  <span>
                    تم رفع <strong>{counts.success}</strong>، فشل <strong>{counts.error}</strong> —
                    اضغط على البطاقات الحمراء لرؤية السبب
                  </span>
                </>
              )}
            </div>
            {allDone && (
              <button
                type="button"
                className="iram-bgu__banner-clear"
                onClick={clearAll}
                aria-label="مسح هذه القائمة"
              >
                إخفاء
              </button>
            )}
          </div>

          {/* Tile grid */}
          <div className="iram-bgu__grid">
            {tiles.map((t) => {
              const isExpanded = expandedError === t.id
              const isError = t.state === 'error'
              return (
                <div
                  key={t.id}
                  className={`iram-bgu__tile iram-bgu__tile--${t.state}${
                    isExpanded ? 'iram-bgu__tile--expanded' : ''
                  }`}
                >
                  <div className="iram-bgu__thumb-wrap">
                    {/* Local Object URL preview — raw <img> is correct here
                        (Object URLs aren't valid next/image sources). */}
                    <img
                      src={t.previewUrl}
                      alt={t.file.name}
                      className="iram-bgu__thumb"
                      draggable={false}
                    />

                    {/* State overlay — fades the thumb while uploading,
                        fully transparent on success/error so badges
                        sit on top of the image. */}
                    <div className="iram-bgu__overlay" aria-hidden />

                    {/* Status badge top-corner */}
                    <div className={`iram-bgu__badge iram-bgu__badge--${t.state}`} aria-hidden>
                      {t.state === 'pending' && (
                        <svg viewBox="0 0 16 16" width="14" height="14">
                          <circle
                            cx="8"
                            cy="8"
                            r="6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                        </svg>
                      )}
                      {t.state === 'uploading' && (
                        <svg viewBox="0 0 16 16" width="14" height="14">
                          <circle
                            cx="8"
                            cy="8"
                            r="6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeDasharray="20 14"
                            strokeLinecap="round"
                          >
                            <animateTransform
                              attributeName="transform"
                              type="rotate"
                              from="0 8 8"
                              to="360 8 8"
                              dur="1s"
                              repeatCount="indefinite"
                            />
                          </circle>
                        </svg>
                      )}
                      {t.state === 'success' && (
                        <svg viewBox="0 0 16 16" width="14" height="14">
                          <path
                            d="M3 8.5l3.5 3.5L13 5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                      {t.state === 'error' && (
                        <svg viewBox="0 0 16 16" width="14" height="14">
                          <path
                            d="M4 4l8 8M12 4l-8 8"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </div>

                    {/* Remove (x) button — only when NOT mid-upload */}
                    {t.state !== 'uploading' && t.state !== 'pending' && (
                      <button
                        type="button"
                        className="iram-bgu__remove"
                        onClick={() => removeTile(t.id)}
                        aria-label="إزالة من القائمة"
                      >
                        ×
                      </button>
                    )}

                    {/* Click target — opens the error detail panel for
                        error tiles. Success/uploading tiles ignore clicks. */}
                    {isError && (
                      <button
                        type="button"
                        className="iram-bgu__tile-trigger"
                        onClick={() => setExpandedError(isExpanded ? null : t.id)}
                        aria-label={isExpanded ? 'إخفاء تفاصيل الخطأ' : 'عرض تفاصيل الخطأ'}
                        aria-expanded={isExpanded}
                      />
                    )}
                  </div>

                  <div className="iram-bgu__meta">
                    <span className="iram-bgu__name" title={t.file.name}>
                      {truncateName(t.file.name)}
                    </span>
                    <span className="iram-bgu__size">{formatBytes(t.file.size)}</span>
                  </div>

                  {/* Error panel — expands below the tile when clicked */}
                  {isError && isExpanded && (
                    <div className="iram-bgu__error-panel">
                      <p className="iram-bgu__error-msg">{t.errorMessage}</p>
                      <div className="iram-bgu__error-meta">
                        {t.httpStatus !== undefined && <span>HTTP {t.httpStatus}</span>}
                        <span>{t.file.type || '(نوع غير محدد)'}</span>
                      </div>
                      <div className="iram-bgu__error-actions">
                        <button
                          type="button"
                          className="iram-bgu__btn iram-bgu__btn--primary"
                          onClick={() => void retryTile(t.id)}
                        >
                          إعادة المحاولة
                        </button>
                        <button
                          type="button"
                          className="iram-bgu__btn"
                          onClick={() => void copyDiagnostic(t)}
                        >
                          نسخ التفاصيل التقنية
                        </button>
                        <button
                          type="button"
                          className="iram-bgu__btn"
                          onClick={() => removeTile(t.id)}
                        >
                          إزالة
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Size warning chip for soft-limit files (visible
                      during pending/uploading so the editor knows why
                      it's slow). */}
                  {t.file.size > SOFT_SIZE_BYTES &&
                    (t.state === 'pending' || t.state === 'uploading') && (
                      <div className="iram-bgu__size-warn">حجم كبير — قد يستغرق وقتاً</div>
                    )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default BulkGalleryUploader
