import type { Metadata } from 'next'

import { getCategories, getSiteSettings } from '@/lib/queries'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'

export const revalidate = 86400 // 24 h — content changes rarely

export const metadata: Metadata = {
  title: 'بيان إمكانية الوصول · הצהرת נגישות',
  description:
    'بيان إمكانية الوصول لموقع إرم 366 الإخبارية وفقاً لتعليمات شوויון זכויות לאנשים עם מוגבלות (התקנת תקנות 35).',
}

// Israeli accessibility regulation 35 requires the statement page to carry
// specific fields. Each is filled with real published values where the
// codebase already has them (site name, primary email, WhatsApp number)
// and TODO-tagged where the value has to come from the client (postal
// address, accessibility coordinator). See the "Required from client
// before launch" section of the Phase 2 PR for the full TODO list.

const LAST_REVIEW_DATE_ISO = '2026-05-14'
const SUPPORT_EMAIL = 'iramnews366@gmail.com'
const WHATSAPP_NUMBER = '+972-53-578-0141'

export default async function AccessibilityStatementPage() {
  const [siteSettings, categories] = await Promise.all([getSiteSettings(), getCategories()])

  const siteName = siteSettings.siteName ?? 'إرم 366 الإخبارية'

  return (
    <>
      <Header
        siteName={siteName}
        categories={categories.map((c) => ({ name: c.name, slug: c.slug }))}
        logo={siteSettings.logo}
      />

      <main className="container-news py-10">
        <article className="mx-auto max-w-[var(--content-width)]">
          <header className="mb-8 border-b border-[var(--color-border)] pb-6">
            <h1 className="mb-3 font-display font-extrabold text-[var(--font-size-h1)]">
              بيان إمكانية الوصول · הצהرت נגישות
            </h1>
            <p className="text-[var(--color-ink-muted)]">
              آخر مراجعة · עדכון אחרון: 14 מאי 2026 / 14 مايو 2026
            </p>
          </header>

          {/* ARABIC --------------------------------------------------------- */}
          <section dir="rtl" lang="ar" className="prose prose-lg max-w-none">
            <h2>التزامنا بإمكانية الوصول</h2>
            <p>
              يلتزم موقع <strong>إرم 366 الإخبارية</strong> بتوفير محتوى رقمي يمكن لكل الناس الوصول
              إليه، بمن فيهم الأشخاص ذوو الإعاقة، وذلك انسجاماً مع قانون مساواة حقوق الأشخاص ذوي
              الإعاقة (1998) ولوائحه التنظيمية المُعدَّلة، وخاصةً{' '}
              <em>תקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), תשע&quot;ג–2013</em>{' '}
              (لائحة رقم 35).
            </p>

            <h3>مستوى التوافق</h3>
            <p>
              يهدف الموقع إلى الالتزام بمعايير <strong>WCAG 2.0 المستوى AA</strong> الصادرة عن منظمة
              W3C. تم اختبار التصميم على مجموعة من المتصفحات والأجهزة، وتمت مراجعة التباين، أحجام
              الخطوط، التنقل بلوحة المفاتيح، وحقول النماذج.
            </p>

            <h3>أدوات إمكانية الوصول المتاحة</h3>
            <ul>
              <li>
                زر &quot;נגישות · إمكانية الوصول&quot; في تذييل كل صفحة يفتح لوحة تحكم تتيح: تكبير
                الخط، أوضاع تباين عالية، إخفاء الصور، تحويل المؤشر إلى مؤشر كبير، تشغيل وضع قراءة
                الشاشة، وإيقاف الحركة.
              </li>
              <li>
                دعم كامل للتنقل بلوحة المفاتيح: استخدم مفتاح <kbd>Tab</kbd> للتنقل بين الروابط،{' '}
                <kbd>Enter</kbd> للتفعيل، و <kbd>Esc</kbd> لإغلاق النوافذ المنبثقة.
              </li>
              <li>
                الموقع مُهيأ للقارئات الشاشية (NVDA, VoiceOver, TalkBack) عبر سمات ARIA ولغة الصفحة
                المُعرَّفة (<code>lang=&quot;ar&quot;, dir=&quot;rtl&quot;</code>).
              </li>
              <li>تكبير المتصفح حتى 500% بدون فقدان محتوى أو فقدان وظائف.</li>
            </ul>

            <h3>القيود المعروفة</h3>
            <p>نعمل على تحسين إمكانية الوصول باستمرار. القيود المعروفة في النسخة الحالية:</p>
            <ul>
              <li>
                بعض الصور التاريخية في الأرشيف قد لا تتضمن نصاً بديلاً مفصلاً؛ نضيف النص البديل
                تباعاً عند مراجعة المقالات.
              </li>
              <li>
                روابط الفيديو المُضمَّنة من منصات خارجية (يوتيوب) تخضع لإمكانية الوصول الخاصة بتلك
                المنصات، وليس بإمكاننا التحكم الكامل بها.
              </li>
              <li>
                التأثيرات البصرية الزخرفية (مثل أثر المؤشر العربي) لا تُحمَّل على الأجهزة التي تطلب
                تقليل الحركة (<code>prefers-reduced-motion</code>) وفي الأجهزة المحمولة.
              </li>
            </ul>
            <p>
              نُرحِّب بأي ملاحظات أو تقارير عن قيود إضافية. سنُجيب خلال خمسة أيام عمل ونعمل على
              معالجة المشكلة في أقرب وقت ممكن.
            </p>

            <h3>للإبلاغ عن مشكلة في إمكانية الوصول</h3>
            <p>منسِّق إمكانية الوصول لموقع إرم 366 الإخبارية:</p>
            <ul>
              <li>
                الاسم: <strong>[TODO: اسم منسّق إمكانية الوصول كما يطلبه القانون]</strong>
              </li>
              <li>
                البريد الإلكتروني: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
              </li>
              <li>
                الهاتف / واتساب:{' '}
                <a href={`https://wa.me/972535780141`} target="_blank" rel="noopener noreferrer">
                  {WHATSAPP_NUMBER}
                </a>
              </li>
              <li>
                هاتف ثابت بديل: <strong>[TODO: رقم هاتف ثابت إن وُجد، أو يُحذف هذا السطر]</strong>
              </li>
              <li>
                العنوان البريدي:{' '}
                <strong>[TODO: العنوان البريدي للشركة لاستلام الشكاوى الكتابية]</strong>
              </li>
            </ul>
            <p>
              يُرجى تضمين أكبر قدر من التفاصيل ممكنة: عنوان الصفحة، نوع المتصفح، الأداة المُساعِدة
              المستخدمة (إن وُجدت)، ووصف للمشكلة. سنرد خلال خمسة أيام عمل.
            </p>

            <h3>تواريخ المراجعة</h3>
            <p>
              تاريخ آخر مراجعة لهذا البيان:{' '}
              <time dateTime={LAST_REVIEW_DATE_ISO}>14 مايو 2026</time>. نُراجع البيان مع كل تحديث
              جوهري للموقع وعلى الأقل مرة واحدة في السنة.
            </p>
          </section>

          {/* HEBREW --------------------------------------------------------- */}
          <section
            dir="ltr"
            lang="he"
            className="prose prose-lg mt-12 max-w-none border-t border-[var(--color-border)] pt-10"
          >
            <h2>הצהרת נגישות</h2>
            <p>
              אתר <strong>איראם 366 הידיעות (إرم 366 الإخبارية)</strong> מחויב לאפשר גישה שווה
              לתכניו לכלל הציבור, לרבות אנשים עם מוגבלות, וזאת בהתאם לחוק שוויון זכויות לאנשים עם
              מוגבלות, התשנ&quot;ח–1998, ובמיוחד בהתאם ל
              <em>תקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), תשע&quot;ג–2013</em>{' '}
              (תקנה 35).
            </p>

            <h3>רמת התאמה</h3>
            <p>
              האתר שואף לעמוד בתקן <strong>WCAG 2.0 ברמה AA</strong> של W3C. נבדקו ניגודיות צבעים,
              גודלי גופן, ניווט במקלדת, מבני קישורים, וטפסים.
            </p>

            <h3>אמצעי הנגשה זמינים באתר</h3>
            <ul>
              <li>
                כפתור &quot;נגישות&quot; בתחתית כל עמוד פותח חלונית הגדרות עם: הגדלת גופן, מצבי
                ניגודיות גבוהה, השבתת תמונות, סמן מוגדל, מצב הקראת מסך, והשתקת תנועה.
              </li>
              <li>
                תמיכה מלאה בניווט במקלדת — <kbd>Tab</kbd> לעבור בין קישורים,
                <kbd>Enter</kbd> להפעלה, <kbd>Esc</kbd> לסגור חלוניות.
              </li>
              <li>
                תאימות לקוראי מסך (NVDA, VoiceOver, TalkBack) באמצעות תכונות ARIA והגדרת שפת הדף.
              </li>
              <li>ניתן להגדיל את העמוד עד 500% ללא איבוד תוכן או פגיעה בתפקוד.</li>
            </ul>

            <h3>מגבלות ידועות</h3>
            <p>אנו פועלים לשיפור מתמיד של הנגישות באתר. בגרסה הנוכחית קיימות המגבלות הבאות:</p>
            <ul>
              <li>
                חלק מהתמונות הארכיוניות עשויות שלא לכלול תיאור חלופי (alt) מפורט; התיאורים נוספים
                בהדרגה במהלך עדכוני המאמרים.
              </li>
              <li>
                הטמעות וידאו מפלטפורמות חיצוניות (יוטיוב) כפופות לרמת הנגישות של אותן הפלטפורמות,
                מעבר לשליטתנו.
              </li>
              <li>
                אפקטים ויזואליים דקורטיביים (כגון עקבות עט הסמן) אינם נטענים במכשירים שביקשו לצמצם
                תנועה (<code>prefers-reduced-motion</code>) ובמכשירי מובייל.
              </li>
            </ul>
            <p>נשמח לקבל דיווחים על מגבלות נוספות; נחזיר תשובה תוך חמישה ימי עבודה.</p>

            <h3>פנייה לרכז/ת הנגישות</h3>
            <p>רכז/ת הנגישות של אתר איראם 366:</p>
            <ul>
              <li>
                שם: <strong>[TODO: שם רכז/ת הנגישות כפי שמחייב החוק]</strong>
              </li>
              <li>
                דוא&quot;ל: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
              </li>
              <li>
                טלפון / וואטסאפ:{' '}
                <a href={`https://wa.me/972535780141`} target="_blank" rel="noopener noreferrer">
                  {WHATSAPP_NUMBER}
                </a>
              </li>
              <li>
                טלפון נייח חלופי: <strong>[TODO: מספר טלפון נייח אם קיים]</strong>
              </li>
              <li>
                כתובת למשלוח דואר: <strong>[TODO: כתובת דואר רשמית של החברה]</strong>
              </li>
            </ul>
            <p>
              אנא ציינו ככל האפשר: כתובת הדף, סוג הדפדפן, טכנולוגיה מסייעת בשימוש, ותיאור הבעיה.
              תשובה תוך חמישה ימי עבודה.
            </p>

            <h3>תאריך עדכון</h3>
            <p>
              עדכון אחרון של ההצהרה: <time dateTime={LAST_REVIEW_DATE_ISO}>14 במאי 2026</time>.
              ההצהרה מתעדכנת בכל שינוי מהותי באתר ולפחות פעם בשנה.
            </p>
          </section>
        </article>
      </main>

      <Footer
        siteName={siteName}
        footerText={siteSettings.footerText}
        socialLinks={siteSettings.socialLinks}
        categories={categories.map((c) => ({ name: c.name, slug: c.slug }))}
        enableFooterCamel={siteSettings.signatureUi?.enableFooterCamel !== false}
      />
    </>
  )
}
