import type { GlobalConfig } from 'payload'
import { revalidatePath } from 'next/cache'

import { ArticleStatus, HeroMode } from '../../domain/enums.ts'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'إعدادات الموقع',
  admin: {
    description:
      'الإعدادات العامة للموقع: الاسم، الشعار، روابط وسائل التواصل، والتذييل. يؤثر أي تغيير هنا على كل صفحات الموقع.',
  },
  access: {
    read: () => true,
    update: ({ req: { user } }) => user?.role === 'admin',
  },
  hooks: {
    afterChange: [
      // Any edit in /admin → site-settings should be reflected on the public
      // site on the next request. The frontend root layout reads this global
      // for the cursor-ink toggle and every page reads it for the camel
      // toggle, so the cheapest correct thing is to drop the whole frontend
      // tree's cache. The next request rebuilds it.
      async () => {
        revalidatePath('/', 'layout')
      },
    ],
  },
  fields: [
    {
      name: 'siteName',
      type: 'text',
      defaultValue: 'إرم 366 الإخبارية',
      label: 'اسم الموقع',
      admin: {
        description: 'الاسم الرسمي للموقع. يظهر في شريط المتصفح، في نتائج جوجل، وأسفل كل صفحة.',
      },
    },
    {
      name: 'siteDescription',
      type: 'textarea',
      label: 'وصف الموقع',
      admin: {
        description:
          'وصف قصير (جملة أو جملتان) يظهر في نتائج جوجل وعند مشاركة رابط الموقع الرئيسي. مهم للـ SEO.',
      },
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      label: 'الشعار',
      admin: {
        description: 'شعار الموقع الذي يظهر في شريط التصفح العلوي. مُوصى بصورة PNG شفافة.',
      },
    },
    {
      name: 'socialLinks',
      type: 'group',
      label: 'روابط التواصل الاجتماعي',
      admin: {
        description:
          'الروابط التي تظهر في التذييل والشريط الجانبي. اترك الحقل فارغاً إذا لم يكن لديك حساب.',
      },
      fields: [
        {
          name: 'whatsapp',
          type: 'text',
          label: 'واتساب',
          admin: {
            description: 'رابط قناة الواتساب الكاملة.',
            placeholder: 'https://whatsapp.com/channel/...',
          },
        },
        {
          name: 'instagram',
          type: 'text',
          label: 'انستغرام',
          admin: {
            placeholder: 'https://www.instagram.com/...',
          },
        },
        {
          name: 'tiktok',
          type: 'text',
          label: 'تيك توك',
          admin: {
            placeholder: 'https://www.tiktok.com/@...',
          },
        },
        {
          name: 'youtube',
          type: 'text',
          label: 'يوتيوب',
          admin: {
            description: 'رابط القناة الكامل.',
            placeholder: 'https://www.youtube.com/@...',
          },
        },
        {
          name: 'telegram',
          type: 'text',
          label: 'تيليجرام',
          admin: {
            description: 'رابط القناة على تيليجرام.',
            placeholder: 'https://t.me/...',
          },
        },
        {
          name: 'facebook',
          type: 'text',
          label: 'فيسبوك',
          admin: {
            placeholder: 'https://www.facebook.com/...',
          },
        },
        {
          name: 'email',
          type: 'email',
          label: 'البريد الإلكتروني',
          admin: {
            description: 'بريد التواصل الرسمي للموقع.',
            placeholder: 'iramnews366@gmail.com',
          },
        },
      ],
    },
    {
      name: 'announcement',
      type: 'group',
      label: 'شريط الإعلانات',
      admin: {
        description:
          'شريط ثابت يظهر أعلى كل صفحات الموقع لإعلانات مهمة (تحديث، صيانة، خبر استثنائي). مختلف عن شريط الأخبار العاجلة الذي يُعرض تلقائياً من المقالات المُعلَّمة كعاجلة.',
      },
      fields: [
        {
          name: 'show',
          type: 'checkbox',
          defaultValue: false,
          label: 'تفعيل الشريط',
          admin: {
            description: 'أوقف هذا الخيار لإخفاء الشريط دون حذف نصه.',
          },
        },
        {
          name: 'message',
          type: 'text',
          label: 'نص الإعلان',
          admin: {
            description: 'النص الذي يراه الزوار (يُفضَّل ألا يتجاوز 100 حرف).',
            placeholder: 'مثال: الموقع تحت الصيانة يوم الجمعة من 2:00 إلى 4:00 صباحاً',
            condition: (_, siblingData) => Boolean(siblingData?.show),
          },
        },
        {
          name: 'variant',
          type: 'select',
          defaultValue: 'info',
          options: [
            { label: 'معلومة (أزرق)', value: 'info' },
            { label: 'تنبيه (أصفر)', value: 'warning' },
            { label: 'هام (أحمر)', value: 'danger' },
            { label: 'ترويجي (ذهبي)', value: 'promo' },
          ],
          label: 'نوع الإعلان',
          admin: {
            description: 'اللون يُساعد القارئ على فهم أولوية الإعلان بسرعة.',
            condition: (_, siblingData) => Boolean(siblingData?.show),
          },
        },
        {
          name: 'link',
          type: 'text',
          label: 'رابط (اختياري)',
          admin: {
            description: 'لجعل الشريط قابلاً للضغط — مثلاً رابط لصفحة "من نحن" أو مقال محدد.',
            placeholder: '/about',
            condition: (_, siblingData) => Boolean(siblingData?.show),
          },
        },
        {
          name: 'dismissible',
          type: 'checkbox',
          defaultValue: true,
          label: 'يمكن للزائر إخفاء الشريط',
          admin: {
            description: 'يُضاف زر × يسمح للزائر بإخفاء الشريط لنفسه فقط.',
            condition: (_, siblingData) => Boolean(siblingData?.show),
          },
        },
      ],
    },
    {
      name: 'homepageHero',
      type: 'group',
      label: 'القسم الرئيسي (الهيرو)',
      admin: {
        description:
          'تحكم كامل بالمقالات التي تظهر في أعلى الصفحة الرئيسية. الوضع التلقائي يعرض آخر المقالات المميزة؛ الوضع اليدوي يسمح لك باختيارها بنفسك.',
      },
      fields: [
        {
          name: 'mode',
          type: 'select',
          defaultValue: HeroMode.Auto,
          required: true,
          options: [
            { label: 'تلقائي — آخر المقالات المميزة', value: HeroMode.Auto },
            { label: 'يدوي — اختر المقالات بنفسك', value: HeroMode.Manual },
          ],
          label: 'وضع العرض',
          admin: {
            description:
              'في الوضع التلقائي: يُعرض آخر 4 مقالات مُفعّل عليها زر "مميز". في الوضع اليدوي: تختار أنت المقالات أدناه.',
          },
        },
        {
          name: 'mainArticle',
          type: 'relationship',
          relationTo: 'articles',
          label: 'المقال الرئيسي (الكبير)',
          admin: {
            description: 'المقال الذي يظهر في البطاقة الكبرى على اليمين في شريط الهيرو.',
            condition: (_, siblingData) => siblingData?.mode === HeroMode.Manual,
          },
          filterOptions: {
            status: { equals: ArticleStatus.Published },
          },
        },
        {
          name: 'secondaryArticles',
          type: 'relationship',
          relationTo: 'articles',
          hasMany: true,
          maxRows: 3,
          label: 'المقالات الثانوية (3 بطاقات صغيرة)',
          admin: {
            description:
              'اختر حتى 3 مقالات تظهر في البطاقات الأصغر بجانب المقال الرئيسي. الترتيب الذي تضيف به ينعكس في العرض.',
            condition: (_, siblingData) => siblingData?.mode === HeroMode.Manual,
          },
          filterOptions: {
            status: { equals: ArticleStatus.Published },
          },
        },
      ],
    },
    {
      name: 'footerText',
      type: 'textarea',
      label: 'نص التذييل',
      admin: {
        description: 'نص حقوق النشر والمعلومات التي تظهر أسفل كل صفحة.',
        placeholder: 'جميع الحقوق محفوظة © إرم 366 الإخبارية',
      },
    },
    {
      name: 'signatureUi',
      type: 'group',
      label: 'لمسات بصرية',
      admin: {
        description:
          'تأثيرات بصرية إضافية على الموقع. يمكن إيقاف أيٍّ منها فوراً دون نشر جديد عند الحاجة (مثلاً في فترات الحداد أو الأحداث الجسيمة).',
      },
      fields: [
        {
          name: 'enableCursorInk',
          type: 'checkbox',
          defaultValue: true,
          label: 'إظهار خطّ الحبر العربي للفأرة',
          admin: {
            description:
              'يرسم خطّاً ذهبياً خفيفاً يتبع الفأرة على أجهزة سطح المكتب. يختفي تلقائياً فوق النصوص.',
          },
        },
        {
          name: 'enableFooterCamel',
          type: 'checkbox',
          defaultValue: true,
          label: 'إظهار الجمل في الذيل',
          admin: {
            description: 'يمكن إيقافه مؤقتاً في فترات الأحداث الجسيمة أو الحداد.',
          },
        },
      ],
    },
    {
      name: 'socialHub',
      type: 'group',
      label: 'مركز روابط التواصل الاجتماعي',
      admin: {
        description:
          'مركز عائم في الزاوية السفلية اليسرى يفتح روابط الشبكات الاجتماعية المعرّفة في "روابط التواصل الاجتماعي" أعلاه. لا تظهر أيقونة لمنصة إذا كان رابطها فارغاً.',
      },
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          defaultValue: true,
          label: 'تفعيل مركز التواصل الاجتماعي',
          admin: {
            description: 'يمكن إيقافه مؤقتاً دون نشر جديد.',
          },
        },
      ],
    },
  ],
}
