import type { Metadata } from 'next'

import { getCategories, getSiteSettings } from '@/lib/queries'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'

export const revalidate = 86400

export const metadata: Metadata = {
  title: 'تواصل معنا',
  description:
    'قنوات التواصل الرسمية مع موقع إرم 366 الإخبارية: التحرير، إرسال خبر، إمكانية الوصول، الخصوصية، الإعلان.',
}

const SUPPORT_EMAIL = 'iramnews366@gmail.com'
const WHATSAPP_NUMBER = '+972-53-578-0141'

export default async function ContactPage() {
  const [siteSettings, categories] = await Promise.all([getSiteSettings(), getCategories()])
  const siteName = siteSettings.siteName ?? 'إرم 366 الإخبارية'
  const social = siteSettings.socialLinks ?? {}

  return (
    <>
      <Header
        siteName={siteName}
        categories={categories.map((c) => ({ name: c.name, slug: c.slug }))}
        logo={siteSettings.logo}
      />

      <main className="container-news py-10">
        <article className="mx-auto max-w-[var(--content-width)]" dir="rtl">
          <header className="mb-6 border-b border-[var(--color-border)] pb-6">
            <h1 className="mb-2 font-display font-extrabold text-[var(--font-size-h1)]">
              تواصل معنا
            </h1>
            <p className="text-lg text-[var(--color-ink-light)]">
              نرحّب بأخبارك، ملاحظاتك، تصحيحاتك، واقتراحاتك. تواصلك يصل إلينا مباشرةً ونحرص على
              الردّ خلال خمسة أيام عمل.
            </p>
          </header>

          <section className="prose prose-lg max-w-none">
            <h2>القنوات الرسمية</h2>

            <h3>📧 البريد الإلكتروني للتحرير</h3>
            <p>
              للتقارير، الاستفسارات الصحفية، التصحيحات، والشكاوى التحريرية:{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </p>

            <h3>📱 واتساب</h3>
            <p>
              لإرسال خبر عاجل، صورة، أو مقطع فيديو من الميدان:{' '}
              <a href="https://wa.me/972535780141" target="_blank" rel="noopener noreferrer">
                {WHATSAPP_NUMBER}
              </a>
              <br />
              يفضَّل إرفاق: المكان، الوقت التقريبي، ومصدر المعلومة. الرسائل الموثّقة تُعالَج أسرع.
            </p>

            {social.whatsapp && (
              <p>
                للانضمام إلى قناة الواتساب الرسمية:{' '}
                <a href={social.whatsapp} target="_blank" rel="noopener noreferrer">
                  قناة إرم 366 على واتساب
                </a>
              </p>
            )}

            <h3>🌐 الشبكات الاجتماعية</h3>
            <ul>
              {social.instagram && (
                <li>
                  انستغرام:{' '}
                  <a href={social.instagram} target="_blank" rel="noopener noreferrer">
                    {social.instagram}
                  </a>
                </li>
              )}
              {social.tiktok && (
                <li>
                  تيك توك:{' '}
                  <a href={social.tiktok} target="_blank" rel="noopener noreferrer">
                    {social.tiktok}
                  </a>
                </li>
              )}
              {social.facebook && (
                <li>
                  فيسبوك:{' '}
                  <a href={social.facebook} target="_blank" rel="noopener noreferrer">
                    {social.facebook}
                  </a>
                </li>
              )}
              {social.youtube && (
                <li>
                  يوتيوب:{' '}
                  <a href={social.youtube} target="_blank" rel="noopener noreferrer">
                    {social.youtube}
                  </a>
                </li>
              )}
              {social.telegram && (
                <li>
                  تيليجرام:{' '}
                  <a href={social.telegram} target="_blank" rel="noopener noreferrer">
                    {social.telegram}
                  </a>
                </li>
              )}
            </ul>

            <h2>قنوات متخصّصة</h2>

            <h3>إمكانية الوصول (Accessibility)</h3>
            <p>
              للإبلاغ عن مشاكل في إمكانية الوصول إلى الموقع، أو لطلب محتوى بصيغة بديلة: راجع{' '}
              <a href="/accessibility-statement">بيان إمكانية الوصول</a> أو تواصل مع منسّق إمكانية
              الوصول عبر <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </p>

            <h3>الخصوصية وحماية البيانات</h3>
            <p>
              لممارسة حقوقك بموجب قانون حماية الخصوصية الإسرائيلي (1981) أو لائحة GDPR، أو للإبلاغ
              عن مخاوف تتعلّق ببيانات الزوار: راجع <a href="/privacy">سياسة الخصوصية</a> أو راسلنا
              على <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> مع وضع &quot;خصوصية&quot;
              في عنوان الرسالة.
            </p>

            <h3>الإعلان</h3>
            <p>
              للاستفسار عن الإعلان على إرم 366 (شريط علوي، الشريط الجانبي، نهاية المقالات، التذييل):
              راسلنا على <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> مع وضع
              &quot;إعلان&quot; في عنوان الرسالة، وسنُرسل لك ورقة الأسعار والمواصفات الفنية.
            </p>

            <h3>التواصل القانوني</h3>
            <p>
              للاستفسارات القانونية، طلبات حقّ الردّ، أو الطلبات الرسمية:{' '}
              <strong>
                [TODO: عنوان البريد الإلكتروني للتواصل القانوني إن وُجد، وإلا يُستخدم البريد العام]
              </strong>
              . العنوان البريدي للمراسلة الرسمية:{' '}
              <strong>[TODO: العنوان البريدي الرسمي للشركة]</strong>.
            </p>

            <h2>نموذج تواصل</h2>
            <p className="rounded-md border border-[var(--color-border)] bg-cream-dark p-4 text-base text-[var(--color-ink-light)]">
              نموذج التواصل المباشر داخل الموقع قيد التطوير وسيُتاح في مرحلة لاحقة بعد الإطلاق. حتى
              ذلك الحين، يُرجى استخدام البريد الإلكتروني أو الواتساب أعلاه — نضمن متابعة كلّ رسالة
              شخصياً.
            </p>

            <h2>الجهة الناشرة</h2>
            <p>
              لشركة <strong>إرم 366 الإخبارية م.ض</strong> ·{' '}
              <strong>[TODO: رقم الشركة (ח.פ.)]</strong> ·{' '}
              <strong>[TODO: العنوان البريدي الرسمي]</strong>.
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
