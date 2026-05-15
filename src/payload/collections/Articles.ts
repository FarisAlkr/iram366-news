import type { CollectionConfig } from 'payload'

import { ArticleStatus, UserRole } from '../../domain/enums.ts'
import { computeStats } from '../../lib/article-stats.ts'
import { ensureSlug } from '../../lib/slug.ts'
import { logger } from '../../lib/logger.ts'
import { isAdmin, isAuthenticated, isOwnerOrAdminEditor } from '../access/index.ts'
import { auditAfterChange, auditAfterDelete } from '../hooks/audit.ts'
import { notifyOnArticleStatusChange } from '../hooks/notify.ts'
import { embedArticleAfterChange, embedArticleAfterDelete } from '../hooks/embed-article.ts'
import {
  revalidateArticlesAfterChange,
  revalidateArticlesAfterDelete,
} from '../hooks/revalidate.ts'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const previewSecret = process.env.PAYLOAD_PREVIEW_SECRET || 'change-me-preview-secret'

const STATUS_OPTIONS: Array<{ label: string; value: ArticleStatus }> = [
  { label: 'مسودة', value: ArticleStatus.Draft },
  { label: 'قيد المراجعة', value: ArticleStatus.InReview },
  { label: 'منشور', value: ArticleStatus.Published },
  { label: 'مؤرشف', value: ArticleStatus.Archived },
]

export const Articles: CollectionConfig = {
  slug: 'articles',
  labels: { singular: 'مقال', plural: 'المقالات' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: [
      'featuredImage',
      'title',
      'category',
      'status',
      'isBreaking',
      'views',
      'publishedAt',
    ],
    listSearchableFields: ['title', 'excerpt', 'slug'],
    description: 'إدارة المقالات الإخبارية — أنشئ، عدّل، وانشر قصصك من هنا.',
    preview: (doc) => {
      const slug = (doc as { slug?: string })?.slug
      if (!slug) return null
      return `${siteUrl}/preview/articles/${slug}?secret=${previewSecret}`
    },
  },
  defaultSort: '-publishedAt',
  versions: { drafts: false, maxPerDoc: 20 },
  fields: [
    // -- sidebar --
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: ArticleStatus.Draft,
      options: STATUS_OPTIONS,
      index: true,
      label: 'الحالة',
      admin: {
        position: 'sidebar',
        description:
          'مسودة: مرئية لك فقط. قيد المراجعة: بانتظار موافقة المحرر. منشور: يراها الجمهور. مؤرشف: مخفية من الموقع لكن محفوظة.',
        components: {
          Cell: '/components/admin/StatusCell#StatusCell',
        },
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'تاريخ النشر',
      index: true,
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description:
          'يُضبط تلقائياً عند تغيير الحالة إلى "منشور". لجدولة النشر لاحقاً، اختر تاريخاً مستقبلياً مع الحالة "منشور" — لن يظهر للقراء قبل ذلك الموعد.',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'الرابط',
      admin: {
        position: 'sidebar',
        description:
          'الرابط النهائي للمقال (يُنشأ تلقائياً من العنوان). تجنب تغييره بعد النشر حفاظاً على SEO.',
        components: {
          afterInput: ['/components/admin/SlugUrlPreview#SlugUrlPreview'],
        },
      },
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      label: 'الكاتب',
      admin: {
        position: 'sidebar',
        description: 'يُعيَّن تلقائياً. يمكن للمدير تغييره لنسب المقال لكاتب آخر.',
      },
    },
    {
      name: 'isFeatured',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      label: '⭐ مميّز (يظهر في الهيرو)',
      admin: {
        position: 'sidebar',
        description: 'فعّل لإظهار المقال في القسم الرئيسي على الصفحة الرئيسية.',
      },
    },
    {
      name: 'isBreaking',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      label: '🔴 عاجل (في الشريط المتحرك)',
      admin: {
        position: 'sidebar',
        description:
          'فعّل لإظهار عنوان المقال في شريط الأخبار العاجلة. يمكن أيضاً التبديل بنقرة واحدة من قائمة المقالات (العمود الأحمر).',
        components: {
          Cell: '/components/admin/BreakingToggleCell#BreakingToggleCell',
        },
      },
    },
    {
      name: 'views',
      type: 'number',
      defaultValue: 0,
      label: 'عدد المشاهدات',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'يُحسب تلقائياً عند زيارة القراء.',
      },
    },
    {
      // Per-article hero placement picker — lets editors mark this article
      // as Main / Secondary 1-3 / None directly from the article edit page,
      // instead of navigating to Site Settings → homepageHero.
      name: 'heroPlacementPicker',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '/components/admin/HeroPlacementPicker#HeroPlacementPicker',
        },
      },
    },
    {
      // One-tap "Share to WhatsApp" — sidebar button that opens the WhatsApp
      // app pre-filled with the article title + URL.
      name: 'whatsappShare',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '/components/admin/WhatsAppShare#WhatsAppShare',
        },
      },
    },
    {
      name: 'readingTime',
      type: 'number',
      defaultValue: 0,
      label: 'وقت القراءة (دقائق)',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'يُحسب تلقائياً من نص المقال — لا تحرّر يدوياً.',
      },
    },
    {
      name: 'deletedAt',
      type: 'date',
      label: 'تاريخ الحذف (السلة)',
      index: true,
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description:
          'إذا ضُبطت قيمة هنا يصبح المقال في "سلة المحذوفات" — مخفي من الموقع لكن محفوظ. اتركها فارغة للمقال النشط.',
      },
    },

    // -- tabs --
    {
      type: 'tabs',
      tabs: [
        {
          label: 'المحتوى',
          description: 'العنوان، المقتطف، ونص المقال الكامل.',
          fields: [
            {
              name: 'title',
              type: 'text',
              required: true,
              maxLength: 120,
              label: 'العنوان',
              admin: {
                description:
                  '💡 الطول الأمثل: 40–80 حرفاً. العنوان الجيد واضح، يثير الفضول، ولا يكرر نفس كلمات كل مقال. سيُنشأ الرابط (slug) تلقائياً من العنوان.',
                placeholder: 'مثال: افتتاح مشروع جديد لدعم الشباب في رهط',
              },
            },
            {
              // Invisible side-effect field — auto-fills the slug from the
              // title (Arabic → Latin) until the editor types a custom one.
              name: 'titleSlugAutofill',
              type: 'ui',
              admin: {
                components: {
                  Field: '/components/admin/SlugAutofill#SlugAutofill',
                },
              },
            },
            {
              name: 'excerpt',
              type: 'textarea',
              required: true,
              maxLength: 300,
              label: 'المقتطف',
              admin: {
                description:
                  '💡 الطول الأمثل: 150–250 حرفاً (الحد الأقصى 300). ملخص سريع للمقال يظهر تحت العنوان في البطاقات وفي نتائج جوجل.',
                placeholder: 'مثال: في خطوة لدعم الشباب محلياً، أُعلن اليوم عن افتتاح...',
              },
            },
            {
              name: 'body',
              type: 'richText',
              required: true,
              label: 'نص المقال',
              admin: {
                description:
                  '✏️ محتوى المقال الكامل. استخدم شريط الأدوات أعلى المحرر لإضافة عناوين فرعية، اقتباسات، روابط، قوائم. 📸 لإدراج صورة في وسط النص: اضغط زر "Upload" في شريط الأدوات أو ضع المؤشر في سطر فارغ ثم اضغط +، ثم ارفع الصورة من جهازك. تستطيع إضافة عدد غير محدود من الصور داخل النص.',
              },
            },
            {
              name: 'videoUrl',
              type: 'text',
              label: 'رابط فيديو (اختياري)',
              admin: {
                description:
                  '🎬 الصق رابط فيديو من يوتيوب، تيك توك، انستغرام، فيسبوك، أو X — سيُعرض الفيديو أعلى المقال. اتركه فارغاً للمقالات النصية العادية.',
                placeholder:
                  'https://youtu.be/... | https://www.tiktok.com/@user/video/... | https://www.instagram.com/reel/...',
              },
            },
            {
              name: 'bodyStats',
              type: 'ui',
              admin: {
                components: {
                  Field: '/components/admin/ReadingTimeStats#ReadingTimeStats',
                },
              },
            },
          ],
        },
        {
          label: 'الوسائط والتصنيف',
          description: 'الصورة الرئيسية، التصنيف، والوسوم.',
          fields: [
            {
              name: 'featuredImage',
              type: 'upload',
              relationTo: 'media',
              label: 'الصورة الرئيسية',
              admin: {
                description:
                  '📸 مقاس مُوصى به: 1200×630 بكسل (نسبة 16:9). تظهر أعلى صفحة المقال وفي بطاقة المشاركة.',
              },
            },
            {
              name: 'category',
              type: 'relationship',
              relationTo: 'categories',
              required: true,
              index: true,
              label: 'التصنيف',
              admin: {
                description:
                  'اختر التصنيف الأنسب للمقال. كل مقال ينتمي لتصنيف واحد فقط — اختر الأقرب لموضوع القصة.',
              },
            },
            {
              name: 'series',
              type: 'relationship',
              relationTo: 'series',
              label: 'السلسلة (اختياري)',
              admin: {
                description:
                  'إذا كان المقال جزءاً من سلسلة أو ملف خاص (مثل "ملف انتخابات 2026")، اختر السلسلة هنا.',
              },
            },
            {
              name: 'locations',
              type: 'relationship',
              relationTo: 'locations',
              hasMany: true,
              label: 'المواقع المرتبطة (اختياري)',
              admin: {
                description:
                  'المواقع الجغرافية المذكورة في المقال (رهط، النقب، ...). تساعد القراء على إيجاد كل ما يخص منطقتهم.',
              },
            },
            {
              name: 'tags',
              type: 'array',
              label: 'الوسوم',
              admin: {
                description:
                  '🏷️ أضف 3–6 كلمات مفتاحية (مثل: رهط، تعليم، مجلس محلي). تساعد القارئ على العثور على المقال.',
              },
              fields: [
                {
                  name: 'tag',
                  type: 'text',
                  required: true,
                  label: 'الوسم',
                },
              ],
            },
            {
              // Bulk multi-file uploader for the gallery array below.
              // Editor parity with the mobile /m/new flow: pick many files
              // in one OS dialog, each gets uploaded to /api/media and
              // appended as a new row in `gallery`. Captions remain
              // per-row editable after upload.
              name: 'galleryBulkUploader',
              type: 'ui',
              admin: {
                components: {
                  Field: '/components/admin/BulkGalleryUploader#BulkGalleryUploader',
                },
              },
            },
            {
              name: 'gallery',
              type: 'array',
              label: '🖼️ معرض الصور (متعدد)',
              admin: {
                description:
                  'لإضافة عدة صور في نهاية المقال — مثل تغطية حدث بصور متعددة، أو ملف مصوّر. كل صورة تظهر في شبكة قابلة للنقر، وعند الضغط تكبر مع التعليق. لرفع عدة صور دفعة واحدة، استخدم الزر أعلاه. إذا أردت الصور داخل النص بين الفقرات، استخدم زر Upload في محرر "نص المقال" بدلاً من ذلك.',
              },
              labels: { singular: 'صورة', plural: 'الصور' },
              fields: [
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                  required: true,
                  label: 'الصورة',
                },
                {
                  name: 'caption',
                  type: 'text',
                  label: 'تعليق على الصورة',
                  admin: {
                    description: 'نص قصير يشرح الصورة ويظهر تحتها. اختياري.',
                  },
                },
                {
                  name: 'credit',
                  type: 'text',
                  label: 'حقوق الصورة',
                  admin: {
                    description: 'المصور أو المصدر — يظهر بعد التعليق. اختياري.',
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'تحسين محركات البحث (SEO)',
          description:
            'التحكم بكيفية ظهور المقال في نتائج جوجل وعند مشاركته على وسائل التواصل. اتركها فارغة لاستخدام العنوان والمقتطف الأصليين.',
          fields: [
            {
              name: 'seoPreview',
              type: 'ui',
              admin: {
                components: {
                  Field: '/components/admin/SeoPreview#SeoPreview',
                },
              },
            },
            {
              name: 'seoTitle',
              type: 'text',
              maxLength: 70,
              label: 'عنوان SEO (اختياري)',
              admin: {
                description:
                  '💡 الطول الأمثل: 50–60 حرفاً. العنوان كما يظهر في نتائج جوجل — إذا تركته فارغاً يُستخدم العنوان الرئيسي.',
                placeholder: 'مثال: افتتاح مشروع الشباب — بلدية رهط 2026',
              },
            },
            {
              name: 'seoDescription',
              type: 'textarea',
              maxLength: 160,
              label: 'وصف SEO (اختياري)',
              admin: {
                description:
                  '💡 الطول الأمثل: 120–155 حرفاً. الوصف كما يظهر تحت العنوان في نتائج جوجل.',
                placeholder: 'وصف قصير يشجع الزائر على الضغط على الرابط من نتائج البحث',
              },
            },
            {
              name: 'seoKeywords',
              type: 'text',
              label: 'الكلمات المفتاحية (اختياري)',
              admin: {
                description:
                  'كلمات مفتاحية مفصولة بفواصل. لم تعد جوجل تستخدمها بشكل مباشر، لكن بعض محركات البحث تستخدمها.',
                placeholder: 'رهط, النقب, أخبار محلية, مشاريع شبابية',
              },
            },
            {
              name: 'ogImage',
              type: 'upload',
              relationTo: 'media',
              label: 'صورة المشاركة الاجتماعية (اختياري)',
              admin: {
                description:
                  '🌐 صورة خاصة تظهر عند المشاركة على فيسبوك/واتساب/تويتر. مقاس: 1200×630 بكسل.',
              },
            },
            {
              name: 'canonicalUrl',
              type: 'text',
              label: 'الرابط القانوني (اختياري)',
              admin: {
                description:
                  '🔗 إذا نُشر هذا المقال في موقع آخر أيضاً وكان منشوراً هناك أولاً، أدخل رابطه الأصلي هنا. يخبر جوجل أن النسخة الأصلية في مكان آخر — تجنباً لعقوبات المحتوى المكرر.',
                placeholder: 'https://example.com/original-article',
              },
            },
            {
              name: 'noindex',
              type: 'checkbox',
              defaultValue: false,
              label: 'إخفاء من محركات البحث',
              admin: {
                description:
                  'فعّل هذا لمنع جوجل من فهرسة المقال (للصفحات الخاصة، الإعلانات الممولة، أو المحتوى المؤقت).',
              },
            },
          ],
        },
        {
          label: 'متقدم',
          description:
            'إعدادات متقدمة: المصدر الأصلي للمقال، ملاحظات داخلية للفريق، وحقول للمحتوى المنقول من وكالات.',
          fields: [
            {
              name: 'originalSource',
              type: 'group',
              label: 'المصدر الأصلي (للمحتوى المنقول)',
              admin: {
                description:
                  'املأ هذه الحقول فقط إذا كان المقال منقولاً من مصدر آخر (وكالة أنباء، صحيفة شريكة).',
              },
              fields: [
                {
                  name: 'wireService',
                  type: 'select',
                  label: 'الوكالة',
                  options: [
                    { label: 'لا يوجد (محتوى أصلي)', value: 'none' },
                    { label: 'AFP — وكالة الصحافة الفرنسية', value: 'afp' },
                    { label: 'AP — أسوشيتد برس', value: 'ap' },
                    { label: 'Reuters — رويترز', value: 'reuters' },
                    { label: 'وكالة الأناضول', value: 'anadolu' },
                    { label: 'الجزيرة', value: 'aljazeera' },
                    { label: 'وكالة معا', value: 'maan' },
                    { label: 'أخرى', value: 'other' },
                  ],
                  defaultValue: 'none',
                },
                {
                  name: 'sourceName',
                  type: 'text',
                  label: 'اسم المصدر',
                  admin: { placeholder: 'إذا اخترت "أخرى" أعلاه' },
                },
                {
                  name: 'sourceUrl',
                  type: 'text',
                  label: 'رابط المصدر الأصلي',
                  admin: { placeholder: 'https://...' },
                },
                {
                  name: 'sourceAuthor',
                  type: 'text',
                  label: 'الكاتب الأصلي',
                },
              ],
            },
            {
              name: 'internalNotes',
              type: 'textarea',
              label: 'ملاحظات داخلية (لا تظهر للقارئ)',
              admin: {
                description:
                  '📝 ملاحظات للفريق التحريري — ملاحظات للمحرر، نقاط للتحقق، روابط مرجعية. مرئية فقط لطاقم العمل، لا للقراء.',
                placeholder: 'مثال: تحقق من الأرقام في الفقرة الثالثة...',
              },
            },
          ],
        },
      ],
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        if (!data) return data
        if (operation === 'create' && data.title && !data.slug) {
          data.slug = ensureSlug(data.title)
        }
        return data
      },
    ],
    beforeChange: [
      ({ data, req, operation }) => {
        if (!data) return data

        // Auto-assign author on create
        if (operation === 'create' && req.user) {
          data.author = req.user.id
        }

        // Auto-set publishedAt when crossing into Published
        if (data.status === ArticleStatus.Published && !data.publishedAt) {
          data.publishedAt = new Date().toISOString()
        }

        // Authors cannot self-publish — downgrade to in-review on attempted publish
        if (
          operation === 'update' &&
          req.user?.role === UserRole.Author &&
          data.status === ArticleStatus.Published
        ) {
          data.status = ArticleStatus.InReview
        }

        // Compute reading time from body content. Uses the same shared
        // helper as the admin widget — keeps the displayed estimate and
        // the persisted value in sync.
        if (data.body !== undefined) {
          data.readingTime = computeStats(data.body).readingMinutes
        }

        return data
      },
    ],
    afterChange: [
      auditAfterChange,
      notifyOnArticleStatusChange,
      embedArticleAfterChange,
      revalidateArticlesAfterChange,
    ],
    afterDelete: [auditAfterDelete, embedArticleAfterDelete, revalidateArticlesAfterDelete],
  },
  access: {
    read: ({ req }) => {
      const role = req.user?.role as UserRole | undefined
      if (role === UserRole.Admin || role === UserRole.Editor) return true
      if (role === UserRole.Author && req.user) {
        // Authors see their own (any status) + all published.
        // Cast to `Where` is needed because TS narrows the discriminated
        // union of property keys in object literals — Payload's `Where`
        // type is an index signature and the inferred shape doesn't widen
        // automatically.
        return {
          or: [
            { status: { equals: ArticleStatus.Published } },
            { author: { equals: req.user.id } },
          ],
        } as never
      }
      return { status: { equals: ArticleStatus.Published } }
    },
    create: isAuthenticated,
    update: isOwnerOrAdminEditor('author'),
    delete: isAdmin,
  },
  endpoints: [
    {
      // Duplicate an article — creates a draft copy with " — نسخة" appended.
      path: '/:id/duplicate',
      method: 'post',
      handler: async (req) => {
        const { id } = (req.routeParams ?? {}) as { id: string }
        const payload = req.payload

        if (!req.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const original = await payload.findByID({
            collection: 'articles',
            id,
            depth: 0,
          })
          if (!original) {
            return Response.json({ error: 'Article not found' }, { status: 404 })
          }

          const o = original as unknown as {
            title: string
            slug: string
            excerpt: string
            body: unknown
            category?: unknown
            featuredImage?: unknown
            tags?: unknown
            seoTitle?: unknown
            seoDescription?: unknown
            seoKeywords?: unknown
            ogImage?: unknown
          }

          const duplicated = await payload.create({
            collection: 'articles',
            data: {
              title: `${o.title} — نسخة`,
              slug: `${o.slug}-copy-${Date.now()}`,
              excerpt: o.excerpt,
              body: o.body,
              category: o.category,
              featuredImage: o.featuredImage,
              tags: o.tags,
              seoTitle: o.seoTitle,
              seoDescription: o.seoDescription,
              seoKeywords: o.seoKeywords,
              ogImage: o.ogImage,
              status: ArticleStatus.Draft,
              publishedAt: null,
              views: 0,
              isFeatured: false,
              isBreaking: false,
            } as never,
          })

          return Response.json({ success: true, id: duplicated.id })
        } catch (err) {
          logger.error('articles.duplicate_failed', {
            err,
            articleId: id,
            userId: req.user.id,
          })
          const message = err instanceof Error ? err.message : 'Internal error'
          return Response.json({ error: message }, { status: 500 })
        }
      },
    },
  ],
}

// Re-export for convenience to consumers that import from this file.
export { ArticleStatus }
