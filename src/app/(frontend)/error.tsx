'use client'

export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="text-8xl font-display font-extrabold text-[var(--color-border-dark)] mb-4">
        ٥٠٠
      </div>
      <h1 className="font-display font-bold text-2xl mb-3">حدث خطأ</h1>
      <p className="text-[var(--color-ink-muted)] text-lg mb-8 max-w-md">
        عذراً، حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.
      </p>
      <button
        onClick={reset}
        className="px-6 py-3 bg-accent-gold text-navy font-display font-bold rounded-lg hover:bg-accent-gold-dark transition-colors duration-150"
      >
        إعادة المحاولة
      </button>
    </main>
  )
}
