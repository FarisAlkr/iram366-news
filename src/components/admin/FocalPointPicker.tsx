'use client'

import React from 'react'
import { useDocumentInfo, useForm, useFormFields } from '@payloadcms/ui'

/**
 * Visual focal-point picker. Mounted as a `ui` field on the Media collection.
 * Click anywhere on the image preview → updates focalPoint.x / focalPoint.y
 * (0–100). The dot stays centered on whatever subject the editor wants
 * preserved when the image is auto-cropped for different aspect ratios.
 *
 * Three preview tiles below show how the crop will look at 16:9 (hero),
 * 3:2 (card), and 1:1 (square) — so editors see the consequence in real time.
 */
export const FocalPointPicker: React.FC = () => {
  const { collectionSlug } = useDocumentInfo()
  const { dispatchFields } = useForm()

  const { url, x, y } = useFormFields(([fields]) => ({
    url: fields?.url?.value,
    x: fields?.['focalPoint.x']?.value,
    y: fields?.['focalPoint.y']?.value,
  }))

  const imgRef = React.useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = React.useState(false)

  if (collectionSlug !== 'media' || !url) {
    return (
      <div className="iram-focal" dir="rtl">
        <p className="iram-focal__hint">
          ارفع صورة أولاً واحفظ، ثم انقر على أهم نقطة فيها لتحديد مركز التركيز.
        </p>
      </div>
    )
  }

  const fx = typeof x === 'number' ? x : 50
  const fy = typeof y === 'number' ? y : 50

  const setPoint = (clientX: number, clientY: number) => {
    const el = imgRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const newX = Math.round(((clientX - rect.left) / rect.width) * 100)
    const newY = Math.round(((clientY - rect.top) / rect.height) * 100)
    dispatchFields({
      type: 'UPDATE',
      path: 'focalPoint.x',
      value: Math.max(0, Math.min(100, newX)),
    })
    dispatchFields({
      type: 'UPDATE',
      path: 'focalPoint.y',
      value: Math.max(0, Math.min(100, newY)),
    })
  }

  return (
    <div className="iram-focal" dir="rtl">
      <div className="iram-focal__head">
        <h4 className="iram-focal__title">📍 نقطة التركيز</h4>
        <p className="iram-focal__hint">
          انقر على أهم جزء من الصورة (وجه شخص، حدث رئيسي) ليبقى ظاهراً عند الاقتصاص لمقاسات مختلفة.
        </p>
      </div>

      <div
        ref={imgRef}
        className="iram-focal__canvas"
        role="application"
        aria-label="ضع نقطة التركيز بالنقر على الصورة"
        onClick={(e) => setPoint(e.clientX, e.clientY)}
        onMouseDown={() => setDragging(true)}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
        onMouseMove={(e) => {
          if (dragging) setPoint(e.clientX, e.clientY)
        }}
        onTouchStart={(e) => {
          const t = e.touches[0]
          if (t) {
            setDragging(true)
            setPoint(t.clientX, t.clientY)
          }
        }}
        onTouchMove={(e) => {
          if (!dragging) return
          const t = e.touches[0]
          if (t) {
            // Prevent the browser from interpreting drag as scroll
            e.preventDefault()
            setPoint(t.clientX, t.clientY)
          }
        }}
        onTouchEnd={() => setDragging(false)}
        onTouchCancel={() => setDragging(false)}
        style={{ touchAction: dragging ? 'none' : 'manipulation' }}
      >
        <img src={String(url)} alt="" className="iram-focal__img" draggable={false} />
        <div className="iram-focal__dot" style={{ left: `${fx}%`, top: `${fy}%` }} aria-hidden />
        <div className="iram-focal__guide-h" style={{ top: `${fy}%` }} aria-hidden />
        <div className="iram-focal__guide-v" style={{ left: `${fx}%` }} aria-hidden />
      </div>

      <div className="iram-focal__readout" dir="ltr">
        <span>x: {fx}%</span>
        <span>·</span>
        <span>y: {fy}%</span>
        <button
          type="button"
          className="iram-focal__reset"
          onClick={() => {
            dispatchFields({ type: 'UPDATE', path: 'focalPoint.x', value: 50 })
            dispatchFields({ type: 'UPDATE', path: 'focalPoint.y', value: 50 })
          }}
        >
          إعادة للوسط
        </button>
      </div>

      <div className="iram-focal__previews">
        {[
          { ratio: '16/9', label: 'بطل' },
          { ratio: '3/2', label: 'بطاقة' },
          { ratio: '1/1', label: 'مربع' },
        ].map((r) => (
          <div key={r.ratio} className="iram-focal__preview">
            <div className="iram-focal__preview-label">{r.label}</div>
            <div className="iram-focal__preview-frame" style={{ aspectRatio: r.ratio }}>
              <img
                src={String(url)}
                alt=""
                style={{
                  objectPosition: `${fx}% ${fy}%`,
                  objectFit: 'cover',
                  width: '100%',
                  height: '100%',
                  display: 'block',
                }}
                draggable={false}
              />
            </div>
            <div className="iram-focal__preview-ratio" dir="ltr">
              {r.ratio}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default FocalPointPicker
