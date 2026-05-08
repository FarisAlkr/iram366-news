'use client'

import React from 'react'

const STORAGE_KEY = 'iram366:onboarding-tour-completed:v1'

/**
 * First-login onboarding tour. Shows a 6-step welcome walkthrough on the
 * very first visit (or via a manual trigger). Stored in localStorage so it
 * doesn't bother experienced editors after the first run.
 *
 * Mounted as a provider — wraps the entire admin tree.
 */
export const OnboardingTour: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [step, setStep] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const completed = window.localStorage.getItem(STORAGE_KEY)
    if (!completed) {
      // Slight delay so the admin shell finishes painting first.
      const t = setTimeout(() => setStep(0), 600)
      return () => clearTimeout(t)
    }
  }, [])

  // Listen for a manual trigger so users can re-open the tour from the help menu.
  React.useEffect(() => {
    const onTrigger = () => setStep(0)
    window.addEventListener('iram:open-tour', onTrigger)
    return () => window.removeEventListener('iram:open-tour', onTrigger)
  }, [])

  const finish = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    }
    setStep(null)
  }

  return (
    <>
      {children}
      {step !== null && (
        <TourModal
          step={step}
          onNext={() => setStep((s) => (s !== null && s < TOUR_STEPS.length - 1 ? s + 1 : s))}
          onBack={() => setStep((s) => (s !== null && s > 0 ? s - 1 : s))}
          onSkip={finish}
          onFinish={finish}
        />
      )}
    </>
  )
}

interface TourStep {
  emoji: string
  title: string
  body: React.ReactNode
}

const TOUR_STEPS: TourStep[] = [
  {
    emoji: '👋',
    title: 'أهلاً بك في إرم 366',
    body: (
      <>
        <p>هذه هي لوحة التحكم — من هنا تكتب وتنشر وتدير كل محتوى الموقع.</p>
        <p>سنأخذ جولة سريعة (دقيقة واحدة فقط) لتتعرف على أهم الأقسام.</p>
      </>
    ),
  },
  {
    emoji: '📰',
    title: 'المقالات',
    body: (
      <>
        <p>
          اضغط <strong>المقالات</strong> في القائمة الجانبية لرؤية كل قصصك.
          تستطيع البحث، التصفية، وفتح أي مقال للتحرير.
        </p>
        <p>
          عند الإنشاء، استخدم تبويب <strong>المحتوى</strong> للنص،{' '}
          <strong>الوسائط والتصنيف</strong> للصورة الرئيسية،
          و<strong>SEO</strong> لتحسين ظهور المقال في جوجل.
        </p>
      </>
    ),
  },
  {
    emoji: '🟢',
    title: 'مراحل المقال',
    body: (
      <>
        <p>كل مقال له حالة (في الشريط الجانبي للتحرير):</p>
        <ul>
          <li>
            <strong>مسودة</strong> — مرئية لك فقط، آمنة للحفظ في أي وقت.
          </li>
          <li>
            <strong>قيد المراجعة</strong> — أرسلتها للمحرر، بانتظار موافقته.
          </li>
          <li>
            <strong>منشور</strong> — يراها الجمهور على iram366news.com.
          </li>
          <li>
            <strong>مؤرشف</strong> — مخفية من الموقع لكن محفوظة في النظام.
          </li>
        </ul>
        <p>
          💡 لجدولة النشر لاحقاً، اختر تاريخاً مستقبلياً مع الحالة &ldquo;منشور&rdquo; — لن يظهر للقراء قبل ذلك الموعد.
        </p>
      </>
    ),
  },
  {
    emoji: '👀',
    title: 'المعاينة المباشرة',
    body: (
      <>
        <p>
          أثناء كتابة مقال، ابحث عن زر <strong>Live Preview</strong> أعلى الصفحة.
          يفتح لوحة جانبية تُظهر شكل المقال على الموقع — للهاتف أو اللابتوب.
        </p>
        <p>
          ميدان الكتابة نفسه يبدو الآن كصفحة الموقع: نفس الخط، نفس المسافات، نفس النمط.
          ما تراه هو ما سيراه القارئ.
        </p>
      </>
    ),
  },
  {
    emoji: '⌨️',
    title: 'البحث السريع',
    body: (
      <>
        <p>
          اضغط <kbd>⌘ K</kbd> (أو <kbd>Ctrl K</kbd>) من أي مكان لفتح البحث السريع —
          اكتب أي كلمة من العنوان وستقفز مباشرة للمقال.
        </p>
        <p>
          اضغط <kbd>?</kbd> لعرض كل اختصارات لوحة المفاتيح.
        </p>
      </>
    ),
  },
  {
    emoji: '🚀',
    title: 'جاهز للانطلاق!',
    body: (
      <>
        <p>هذا كل شيء. أهم النصائح للبداية:</p>
        <ul>
          <li>اكتب باستمرار، احفظ مسودات حتى لو لم تكتمل.</li>
          <li>كل صورة يجب أن يكون لها &ldquo;نص بديل&rdquo; — مهم للـ SEO وقارئات الشاشة.</li>
          <li>اختر روابط (slugs) قصيرة وواضحة — لا تغيّرها بعد النشر.</li>
        </ul>
        <p>إذا احتجت رؤية هذه الجولة مرة أخرى، اضغط زر &ldquo;المساعدة&rdquo; في أي وقت.</p>
      </>
    ),
  },
]

const TourModal: React.FC<{
  step: number
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  onFinish: () => void
}> = ({ step, onNext, onBack, onSkip, onFinish }) => {
  const current = TOUR_STEPS[step]
  if (!current) return null
  const isLast = step === TOUR_STEPS.length - 1

  return (
    <div className="iram-tour__overlay" role="presentation" onClick={onSkip}>
      <div
        className="iram-tour__panel"
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="iram-tour-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="iram-tour__head">
          <span className="iram-tour__emoji" aria-hidden>
            {current.emoji}
          </span>
          <button
            type="button"
            className="iram-tour__skip"
            onClick={onSkip}
            aria-label="تخطي الجولة"
          >
            تخطّي
          </button>
        </div>

        <h2 id="iram-tour-title" className="iram-tour__title">
          {current.title}
        </h2>

        <div className="iram-tour__body">{current.body}</div>

        <div className="iram-tour__progress" aria-hidden>
          {TOUR_STEPS.map((_, i) => (
            <span
              key={i}
              className={`iram-tour__dot ${
                i === step ? 'iram-tour__dot--active' : ''
              } ${i < step ? 'iram-tour__dot--done' : ''}`}
            />
          ))}
        </div>

        <div className="iram-tour__actions">
          {step > 0 ? (
            <button type="button" className="iram-tour__btn" onClick={onBack}>
              السابق
            </button>
          ) : (
            <span />
          )}

          {isLast ? (
            <button
              type="button"
              className="iram-tour__btn iram-tour__btn--primary"
              onClick={onFinish}
            >
              ابدأ الكتابة 🚀
            </button>
          ) : (
            <button
              type="button"
              className="iram-tour__btn iram-tour__btn--primary"
              onClick={onNext}
            >
              التالي ←
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default OnboardingTour
