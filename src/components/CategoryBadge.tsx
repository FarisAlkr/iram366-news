import Link from 'next/link'

interface CategoryBadgeProps {
  name: string
  slug: string
  color?: string | null
  size?: 'sm' | 'md'
  /**
   * Render as plain text instead of a category link. Required inside cards
   * that are already wrapped in a link: <a> inside <a> is invalid HTML, the
   * browser's parser splits the outer link apart, and React's hydration
   * then fails and re-renders the whole page on the client.
   */
  asLink?: boolean
}

export function CategoryBadge({
  name,
  slug,
  color,
  size = 'sm',
  asLink = true,
}: CategoryBadgeProps) {
  const className = `inline-block font-display font-semibold tracking-wide transition-opacity duration-150 hover:opacity-80 ${size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'} `
  const style = {
    backgroundColor: color || '#c1121f',
    color: '#fff',
    borderRadius: '2px',
  }

  if (!asLink) {
    return (
      <span className={className} style={style}>
        {name}
      </span>
    )
  }

  return (
    <Link href={`/category/${slug}`} className={className} style={style}>
      {name}
    </Link>
  )
}
