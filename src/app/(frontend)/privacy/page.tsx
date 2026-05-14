import type { Metadata } from 'next'

import { getCategories, getSiteSettings } from '@/lib/queries'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'

export const revalidate = 86400 // 24 h — privacy policy changes rarely

export const metadata: Metadata = {
  title: 'سياسة الخصوصية',
  description:
    'كيف يتعامل موقع إرم 366 الإخبارية مع بيانات الزائرين، الكوكيز، والخدمات الخارجية وفقاً لقانون حماية الخصوصية الإسرائيلي (1981) ولائحة GDPR الأوروبية.',
}

const LAST_UPDATED_ISO = '2026-05-14'
const SUPPORT_EMAIL = 'iramnews366@gmail.com'
const WHATSAPP_NUMBER = '+972-53-578-0141'

export default async function PrivacyPolicyPage() {
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
        <article className="prose prose-lg mx-auto max-w-[var(--content-width)]" dir="rtl">
          <header className="mb-6 border-b border-[var(--color-border)] pb-6">
            <h1 className="mb-2 font-display font-extrabold text-[var(--font-size-h1)]">
              سياسة الخصوصية
            </h1>
            <p className="text-sm text-[var(--color-ink-muted)]">
              آخر تحديث: <time dateTime={LAST_UPDATED_ISO}>14 مايو 2026</time>
            </p>
          </header>

          <h2>1. مقدمة</h2>
          <p>
            تُقدّم هذه السياسة شرحاً للبيانات التي يجمعها موقع <strong>إرم 366 الإخبارية</strong> عن
            زائريه، وكيفية استخدامها، ومن يمكنه الوصول إليها، وحقوقك القانونية كصاحب البيانات. تنطبق
            هذه السياسة على كل صفحات الموقع تحت نطاق
            <code> iram366news.com</code> ولا تنطبق على المواقع الخارجية التي يربط إليها الموقع.
          </p>
          <p>
            نلتزم بأحكام <strong>قانون حماية الخصوصية الإسرائيلي (1981)</strong> ولوائحه المُعدَّلة،
            وكذلك بمبادئ <strong>اللائحة العامة لحماية البيانات (GDPR)</strong> للزائرين من الاتحاد
            الأوروبي.
          </p>

          <h2>2. ما البيانات التي نجمعها</h2>
          <p>
            موقع إرم 366 يعرض المحتوى دون اشتراط تسجيل دخول لزائريه. لا توجد حسابات قُرّاء، ولا
            تعليقات، ولا نماذج تستوجب بيانات شخصية. مع ذلك، تُجمَع البيانات التالية تلقائياً:
          </p>
          <h3>أ. سجلات الخادم</h3>
          <ul>
            <li>عنوان IP (يُستخدم فقط للحدّ من معدّل الطلبات ولاكتشاف هجمات السيل DDoS).</li>
            <li>وقت الزيارة، الصفحة المطلوبة، وحالة الاستجابة (200/404/500).</li>
            <li>نوع المتصفح ونظام التشغيل (User-Agent).</li>
            <li>صفحة الإحالة (Referer)، إن وُجدت.</li>
          </ul>
          <p>تُحفظ هذه السجلات لمدة لا تتجاوز 90 يوماً ثم تُحذَف تلقائياً.</p>

          <h3>ب. كوكيز (Cookies)</h3>
          <ul>
            <li>
              <strong>كوكي مصادقة لوحة التحكم</strong>: تُستخدم فقط لتسجيل دخول المحررين في{' '}
              <code>/admin</code>. لا تُكتب عند زيارة الموقع كقارئ عادي.
            </li>
            <li>
              <strong>كوكي عداد المشاهدات</strong> (<code>viewed_*</code>): تُكتب لمنع احتساب نفس
              المقال أكثر من مرة لنفس الزائر خلال ساعة واحدة. لا تحتوي أي بيانات تعريفية.
            </li>
          </ul>
          <p>لا نستخدم كوكيز للتتبّع الإعلاني ولا للمشاركة مع وسطاء بيانات خارجيين.</p>

          <h3>ج. تحليلات الزوار</h3>
          <p>
            نستخدم <strong>Cloudflare Web Analytics</strong> — وهي خدمة تحليل مجانية وخصوصية أولاً
            (privacy-first): لا تستخدم كوكيز، ولا تجمع IP الزوار، ولا تتتبَّع الجلسات عبر مواقع
            مختلفة. تُقدِّم لنا أرقاماً إجمالية فقط (عدد الزوار، الصفحات الأكثر زيارة، الدول) بدون
            أي بيانات شخصية. تفاصيل:{' '}
            <a
              href="https://www.cloudflare.com/web-analytics/"
              target="_blank"
              rel="noopener noreferrer"
            >
              cloudflare.com/web-analytics
            </a>
            .
          </p>

          <h2>3. الخدمات الخارجية (Third Parties)</h2>
          <ul>
            <li>
              <strong>Cloudflare</strong>: مُزوّد شبكة التوصيل (CDN) وحماية DDoS. تمرّ كل الطلبات
              عبر خوادمه قبل أن تصل إلى موقعنا. سياسة خصوصية Cloudflare:{' '}
              <a
                href="https://www.cloudflare.com/privacypolicy/"
                target="_blank"
                rel="noopener noreferrer"
              >
                cloudflare.com/privacypolicy
              </a>
              .
            </li>
            <li>
              <strong>Hostinger</strong>: مُزوّد الاستضافة (الخادم الفعلي للموقع). سياسة خصوصية
              Hostinger:{' '}
              <a
                href="https://www.hostinger.com/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
              >
                hostinger.com/privacy-policy
              </a>
              .
            </li>
            <li>
              <strong>روابط فيديو يوتيوب</strong>: عند إدراج فيديو من يوتيوب داخل مقال، يُحمَّل
              المشغّل من خوادم Google ويخضع لسياسة خصوصية Google.
            </li>
            <li>
              <strong>UserWay (إن وُجد)</strong>: عند تفعيل ودجة إمكانية الوصول، تُحمَّل ملفات
              JavaScript من <code>cdn.userway.org</code>. لا تكتب UserWay كوكيز للزائرين العاديين.
            </li>
          </ul>

          <h2>4. الاحتفاظ بالبيانات</h2>
          <ul>
            <li>سجلات الخادم: 90 يوماً كحدّ أقصى.</li>
            <li>كوكي عدّاد المشاهدات: ساعة واحدة.</li>
            <li>كوكي مصادقة لوحة التحكم: سنة واحدة (للمحررين فقط).</li>
            <li>إحصاءات Cloudflare: إجمالية بدون بيانات فردية.</li>
          </ul>

          <h2>5. حقوقك القانونية</h2>
          <p>بموجب القانون الإسرائيلي ولائحة GDPR، تتمتّع بالحقوق التالية:</p>
          <ul>
            <li>الحقّ في الاطلاع على البيانات التي بحوزتنا عنك (إن وُجدت).</li>
            <li>الحقّ في تصحيح بيانات غير دقيقة.</li>
            <li>الحقّ في حذف بياناتك ("الحقّ في النسيان").</li>
            <li>الحقّ في تقييد المعالجة.</li>
            <li>
              الحقّ في تقديم شكوى لـ <em>הרשות להגנת הפרטיות</em> (السلطة الإسرائيلية لحماية
              الخصوصية).
            </li>
          </ul>
          <p>لممارسة أيٍّ من هذه الحقوق، تواصل معنا عبر القنوات الموضّحة في القسم التالي.</p>

          <h2>6. الأطفال</h2>
          <p>
            الموقع متاح للجميع ولا يستهدف الأطفال دون الخامسة عشرة بشكل خاص. لا نجمع عمداً أي بيانات
            شخصية من قاصرين. إذا اعتقدت أنّ بيانات قاصر وصلت إلينا، يُرجى إخطارنا فوراً.
          </p>

          <h2>7. التغييرات على هذه السياسة</h2>
          <p>
            قد تطرأ تعديلات على هذه السياسة لمواكبة تغييرات في الخدمة أو في القوانين. التاريخ أعلى
            الصفحة يعكس آخر تحديث. ندعو الزوار إلى مراجعة السياسة بشكل دوري.
          </p>

          <h2>8. تواصل بخصوص الخصوصية</h2>
          <ul>
            <li>
              مسؤول الخصوصية: <strong>[TODO: اسم مسؤول الخصوصية إن طُلب رسمياً]</strong>
            </li>
            <li>
              البريد الإلكتروني: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </li>
            <li>
              الواتساب:{' '}
              <a href="https://wa.me/972535780141" target="_blank" rel="noopener noreferrer">
                {WHATSAPP_NUMBER}
              </a>
            </li>
            <li>
              العنوان البريدي: <strong>[TODO: العنوان البريدي الرسمي للشركة]</strong>
            </li>
            <li>
              الكيان القانوني: لشركة إرم 366 الإخبارية م.ض ·{' '}
              <strong>[TODO: رقم الشركة (ח.פ.)]</strong>
            </li>
          </ul>
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
