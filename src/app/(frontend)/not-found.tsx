import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="text-8xl font-display font-extrabold text-[var(--color-border-dark)] mb-4">
        ٤٠٤
      </div>
      <h1 className="font-display font-bold text-2xl mb-3">الصفحة غير موجودة</h1>
      <p className="text-[var(--color-ink-muted)] text-lg mb-8 max-w-md">
        عذراً، لم نتمكن من العثور على الصفحة المطلوبة. قد تكون قد نُقلت أو حُذفت.
      </p>
      <Link
        href="/"
        className="px-6 py-3 bg-accent-gold text-navy font-display font-bold rounded-lg hover:bg-accent-gold-dark transition-colors duration-150"
      >
        العودة للرئيسية
      </Link>
    </main>
  )
}
