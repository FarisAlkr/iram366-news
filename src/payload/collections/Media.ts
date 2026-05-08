import type { CollectionConfig, Payload } from 'payload'

import { isAdminOrEditor, isAuthenticated, isPublic } from '../access/index.ts'
import { auditAfterChange, auditAfterDelete } from '../hooks/audit.ts'

interface ArticleTitleRow {
  title?: string
}

async function findMediaReferences(
  payload: Payload,
  mediaId: number | string,
): Promise<string[]> {
  const result = await payload.find({
    collection: 'articles',
    where: {
      or: [{ featuredImage: { equals: mediaId } }, { ogImage: { equals: mediaId } }],
    },
    limit: 10,
    depth: 0,
  })
  return (result.docs as unknown as ArticleTitleRow[])
    .map((a) => a.title)
    .filter((t): t is string => Boolean(t))
}

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'وسائط', plural: 'مكتبة الوسائط' },
  admin: {
    description:
      'مكتبة الصور المستخدمة في الموقع. يتم إنشاء 4 مقاسات لكل صورة تلقائياً للاستخدام الأمثل.',
  },
  upload: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml'],
    imageSizes: [
      { name: 'thumbnail', width: 300, height: 200, position: 'centre' },
      { name: 'card', width: 600, height: 400, position: 'centre' },
      { name: 'hero', width: 1200, height: 630, position: 'centre' },
      { name: 'full', width: 1920, height: 1080, position: 'centre' },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      label: 'النص البديل',
      admin: {
        description:
          'وصف قصير للصورة يُقرأه قارئات الشاشة لذوي الإعاقة ويظهر إذا فشل تحميل الصورة. مهم جداً للـ SEO.',
        placeholder: 'وصف مختصر لمحتوى الصورة',
      },
    },
    {
      name: 'caption',
      type: 'text',
      label: 'التعليق',
      admin: {
        description: 'تعليق اختياري يظهر تحت الصورة للقارئ (مثل: "تصوير: محمد الطوري").',
      },
    },
    {
      name: 'photographer',
      type: 'text',
      label: 'المصور',
      admin: {
        description: 'اسم المصور أو الجهة المالكة للصورة. يظهر مع التعليق.',
        placeholder: 'مثال: محمد الطوري',
      },
    },
    {
      name: 'credit',
      type: 'text',
      label: 'حقوق النشر',
      admin: {
        description: 'الجهة التي يجب أن تُنسب لها الصورة (مثل: AFP, Reuters, AP).',
        placeholder: 'مثال: AFP',
      },
    },
    {
      name: 'license',
      type: 'select',
      defaultValue: 'allRightsReserved',
      label: 'نوع الترخيص',
      options: [
        { label: 'كل الحقوق محفوظة', value: 'allRightsReserved' },
        { label: 'إبداعي مشاع — نسب', value: 'cc-by' },
        { label: 'إبداعي مشاع — نسب ومثل', value: 'cc-by-sa' },
        { label: 'ملكية عامة', value: 'publicDomain' },
        { label: 'مشتراة / مرخصة', value: 'licensed' },
        { label: 'استخدام عادل', value: 'fairUse' },
      ],
      admin: {
        description:
          'يساعد على تجنب مشاكل قانونية مستقبلية. اختر "كل الحقوق محفوظة" إذا غير متأكد.',
      },
    },
    {
      name: 'sourceUrl',
      type: 'text',
      label: 'رابط المصدر',
      admin: {
        description: 'إذا كانت الصورة من موقع آخر، أدخل الرابط الأصلي للمرجعية.',
        placeholder: 'https://...',
      },
    },
    {
      name: 'focalPointPicker',
      type: 'ui',
      admin: {
        components: {
          Field: '/components/admin/FocalPointPicker#FocalPointPicker',
        },
      },
    },
    {
      name: 'focalPoint',
      type: 'group',
      label: 'نقطة التركيز (قيم رقمية)',
      admin: {
        description:
          'تُحدّث تلقائياً عند النقر على الصورة في المنتقي أعلاه. القيم 0–100. الوسط = 50,50.',
      },
      fields: [
        {
          name: 'x',
          type: 'number',
          defaultValue: 50,
          min: 0,
          max: 100,
          label: 'النقطة الأفقية',
        },
        {
          name: 'y',
          type: 'number',
          defaultValue: 50,
          min: 0,
          max: 100,
          label: 'النقطة العمودية',
        },
      ],
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
          'إذا ضُبطت قيمة هنا تختفي الصورة من المكتبة الظاهرة لكن تبقى محفوظة.',
      },
    },
  ],
  access: {
    read: isPublic,
    create: isAuthenticated,
    delete: isAdminOrEditor,
  },
  hooks: {
    afterRead: [
      ({ doc }) => {
        // When R2 is fronted by a custom CDN domain (R2_PUBLIC_URL),
        // rewrite media URLs from the internal S3 endpoint to the
        // public domain so visitors load images directly from
        // media.iram366news.com (cached by Cloudflare, no Payload
        // proxy in the hot path).
        const cdn = process.env.R2_PUBLIC_URL?.replace(/\/$/, '')
        if (!cdn) return doc

        const prefix = 'media'
        if (doc?.filename) {
          doc.url = `${cdn}/${prefix}/${doc.filename}`
        }
        if (doc?.sizes && typeof doc.sizes === 'object') {
          for (const sizeKey of Object.keys(doc.sizes)) {
            const size = (doc.sizes as Record<string, { filename?: string; url?: string }>)[sizeKey]
            if (size?.filename) {
              size.url = `${cdn}/${prefix}/${size.filename}`
            }
          }
        }
        return doc
      },
    ],
    beforeDelete: [
      async ({ req, id }) => {
        const titles = await findMediaReferences(req.payload, id)
        if (titles.length === 0) return
        const list = titles.slice(0, 3).join('، ')
        const more = titles.length > 3 ? ` و${titles.length - 3} مقالات أخرى` : ''
        throw new Error(
          `لا يمكن حذف هذه الصورة — تستخدمها المقالات التالية: ${list}${more}. ` +
            `افتح تلك المقالات واستبدل الصورة أولاً.`,
        )
      },
    ],
    afterChange: [auditAfterChange],
    afterDelete: [auditAfterDelete],
  },
}
