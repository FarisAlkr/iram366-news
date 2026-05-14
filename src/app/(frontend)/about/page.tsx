import type { Metadata } from 'next'
import Link from 'next/link'

import { getCategories, getSiteSettings } from '@/lib/queries'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'

export const revalidate = 86400

export const metadata: Metadata = {
  title: 'من نحن',
  description:
    'إرم 366 الإخبارية — منصة إخبارية مستقلة برؤية مختلفة، تواكب أحداث رهط والنقب وتغطّي الشأن المحلي والإقليمي بلغة عربية أولى وعَبرية ثانوية.',
}

export default async function AboutPage() {
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
            <h1 className="mb-3 font-display font-extrabold text-[var(--font-size-h1)]">من نحن</h1>
            <p className="text-lg text-[var(--color-ink-light)]">
              منصة إخبارية مستقلة برؤية مختلفة — نواكب الأحداث لحظة بلحظة من رهط والنقب.
            </p>
          </header>

          <section dir="rtl" className="prose prose-lg max-w-none">
            <h2>رسالتنا</h2>
            <p>
              تأسّست <strong>إرم 366 الإخبارية</strong> في عام 2026 لتكون منصةً إخبارية مستقلة تخدم
              سكان النقب — وخاصةً مدينة رهط والقرى المحيطة بها — بمحتوى محلي يُكتب بلغة قُرّائه ولا
              يُملى عليه من خارج المنطقة. نؤمن بأنّ الخبر المحلي الموثوق هو حجر الزاوية لمجتمع يفهم
              نفسه ويُسائل صانعي القرار.
            </p>

            <h2>تغطيتنا</h2>
            <p>
              نُغطّي ستّ زوايا رئيسية: الأخبار المحلية (رهط والنقب)، السياسة الإسرائيلية في ما يخصّ
              المجتمع العربي، الميدان، الرياضة، المجتمع، والاقتصاد. كلّ مقال يُحرَّر بلغة عربية
              واضحة ويُتاح بصياغة قابلة للقراءة على الهواتف قبل أجهزة سطح المكتب — لأنّ هكذا يقرأنا
              الناس.
            </p>

            <h2>اللغات</h2>
            <p>
              لغة المحتوى الأساسية هي العربية. نُضيف ملخّصات بالعَبرية على الصفحات التي يَطلبها
              القانون (مثل بيان إمكانية الوصول وسياسة الخصوصية)، ونُخطّط لتوسيع التغطية ثلاثية اللغة
              (عربية، عَبرية، إنجليزية) في المراحل القادمة.
            </p>

            <h2>الاستقلالية</h2>
            <p>
              إرم 366 ليست تابعة لأيّ حزب سياسي ولا لأيّ جهة حكومية. نمويلنا قادم من الإعلانات
              المعروضة على الموقع — كلّ إعلان يحمل وسم &quot;مُموَّل&quot; أو &quot;إعلان&quot; بشكل
              واضح وفقاً لمعايير الشفافية المعمول بها.
            </p>

            <h2>فريق التحرير</h2>
            <p>
              <strong>
                [TODO: قائمة بفريق التحرير الفعلي — الأسماء، الأدوار، نبذة قصيرة لكلّ عضو. الصور إن
                أمكن، وروابط حسابات السوشيال الرسمية.]
              </strong>
            </p>
            <p>
              يُمكن لمن يرغب في الانضمام إلى فريق الكُتّاب أو إرسال مادّة للنشر التواصل معنا عبر{' '}
              <Link href="/contact">صفحة التواصل</Link>.
            </p>

            <h2>هيكلية الموقع</h2>
            <ul>
              <li>
                <Link href="/">الصفحة الرئيسية</Link> — أحدث الأخبار + الأقسام المُختارة.
              </li>
              <li>
                <Link href="/search">البحث</Link> — للوصول السريع إلى المقالات السابقة.
              </li>
              <li>
                <Link href="/contact">تواصل معنا</Link> — للاستفسارات، الملاحظات، والمواد الصحفية.
              </li>
              <li>
                <Link href="/privacy">سياسة الخصوصية</Link> — كيف نتعامل مع بيانات الزوار.
              </li>
              <li>
                <Link href="/terms">شروط الاستخدام</Link> — قواعد إعادة استخدام المحتوى.
              </li>
              <li>
                <Link href="/accessibility-statement">بيان إمكانية الوصول</Link> — التزامنا بـ WCAG
                2.0 AA.
              </li>
              <li>
                {/* Internal API route — eslint-disable for the same reason
                    Next.js's no-html-link-for-pages rule allows: it's a
                    file the public can fetch, not a Next page to navigate to. */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/api/feed/rss">RSS</a> — للاشتراك في تغذية الأخبار في قارئ خارجي.
              </li>
            </ul>

            <h2>الجهة الناشرة</h2>
            <p>
              لشركة <strong>إرم 366 الإخبارية م.ض</strong> ·{' '}
              <strong>[TODO: رقم الشركة (ח.פ.) للنشر على الصفحة لأغراض الشفافية]</strong>. العنوان
              البريدي للتواصل: <strong>[TODO: العنوان البريدي الرسمي]</strong>.
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
