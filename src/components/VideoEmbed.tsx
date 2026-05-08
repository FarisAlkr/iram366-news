import { parseVideoUrl, aspectClass } from '@/lib/video-embed'

interface VideoEmbedProps {
  url: string
  title?: string
  className?: string
}

const MAX_WIDTH_BY_ASPECT: Record<string, string> = {
  wide: 'max-w-3xl',
  tall: 'max-w-sm',
  square: 'max-w-md',
}

export function VideoEmbed({ url, title, className }: VideoEmbedProps) {
  const parsed = parseVideoUrl(url)
  if (!parsed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-sm text-blue-600 underline underline-offset-2"
      >
        {title || url}
      </a>
    )
  }

  const aspect = aspectClass(parsed.aspect)
  const maxWidth = MAX_WIDTH_BY_ASPECT[parsed.aspect] ?? 'max-w-3xl'

  return (
    <div className={`mx-auto ${maxWidth} ${className ?? ''}`}>
      <div className={`${aspect} relative w-full rounded-lg overflow-hidden bg-black`}>
        <iframe
          src={parsed.embedSrc}
          title={title || `${parsed.platform} video`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 w-full h-full border-0"
        />
      </div>
    </div>
  )
}
