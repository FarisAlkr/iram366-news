interface SectionHeadingProps {
  title: string
  href?: string
}

export function SectionHeading({ title, href }: SectionHeadingProps) {
  return (
    <div className="mb-6 flex items-center gap-4">
      <div className="h-8 w-1 rounded-full bg-accent-red" />
      <h2 className="font-display font-bold text-[var(--font-size-h2)] text-ink">{title}</h2>
      {href && (
        <a
          href={href}
          className="me-auto text-sm font-medium text-[var(--color-ink-muted)] transition-colors duration-150 hover:text-accent-red"
        >
          عرض الكل ←
        </a>
      )}
      <div className="h-px flex-1 bg-[var(--color-border)]" />
    </div>
  )
}
