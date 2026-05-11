import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 font-display text-8xl font-extrabold text-[var(--color-border-dark)]">
        ٤٠٤
      </div>
      <h1 className="mb-3 font-display text-2xl font-bold">الصفحة غير موجودة</h1>
      <p className="mb-8 max-w-md text-lg text-[var(--color-ink-muted)]">
        عذراً، لم نتمكن من العثور على الصفحة المطلوبة. قد تكون قد نُقلت أو حُذفت.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-accent-gold px-6 py-3 font-display font-bold text-navy transition-colors duration-150 hover:bg-accent-gold-dark"
      >
        العودة للرئيسية
      </Link>
    </main>
  )
}
