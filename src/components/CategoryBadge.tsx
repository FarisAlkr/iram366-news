import Link from 'next/link'

interface CategoryBadgeProps {
  name: string
  slug: string
  color?: string | null
  size?: 'sm' | 'md'
}

export function CategoryBadge({ name, slug, color, size = 'sm' }: CategoryBadgeProps) {
  const bgColor = color || '#c1121f'

  return (
    <Link
      href={`/category/${slug}`}
      className={`inline-block font-display font-semibold tracking-wide transition-opacity duration-150 hover:opacity-80 ${size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'} `}
      style={{
        backgroundColor: bgColor,
        color: '#fff',
        borderRadius: '2px',
      }}
    >
      {name}
    </Link>
  )
}
