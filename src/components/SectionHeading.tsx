interface SectionHeadingProps {
  title: string
  href?: string
}

export function SectionHeading({ title, href }: SectionHeadingProps) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="w-1 h-8 bg-accent-red rounded-full" />
      <h2 className="font-display font-bold text-[var(--font-size-h2)] text-ink">
        {title}
      </h2>
      {href && (
        <a
          href={href}
          className="me-auto text-sm text-[var(--color-ink-muted)] hover:text-accent-red transition-colors duration-150 font-medium"
        >
          عرض الكل ←
        </a>
      )}
      <div className="flex-1 h-px bg-[var(--color-border)]" />
    </div>
  )
}
