import type { CollectionConfig } from 'payload'

import { isAdminOrEditor } from '../access/index.ts'
import { auditAfterChange, auditAfterDelete } from '../hooks/audit.ts'

const STATUS_OPTIONS = [
  { label: 'مسودة', value: 'draft' },
  { label: 'نشط — يظهر للقراء', value: 'active' },
  { label: 'متوقف مؤقتاً', value: 'paused' },
  { label: 'منتهي الصلاحية', value: 'expired' },
]

const PLACEMENT_OPTIONS = [
  { label: 'بانر علوي (header)', value: 'header-banner' },
  { label: 'الشريط الجانبي — أعلى', value: 'sidebar-top' },
  { label: 'الشريط الجانبي — أسفل', value: 'sidebar-bottom' },
  { label: 'بين المقالات في الصفحة الرئيسية', value: 'between-articles' },
  { label: 'داخل المقال (وسط النص)', value: 'article-inline' },
  { label: 'تحت المقال', value: 'article-end' },
  { label: 'تذييل الصفحة (footer)', value: 'footer' },
]

const ADVERTISER_TYPE_OPTIONS = [
  { label: 'محل تجاري', value: 'shop' },
  { label: 'مطعم', value: 'restaurant' },
  { label: 'خدمات', value: 'service' },
  { label: 'حدث / فعالية', value: 'event' },
  { label: 'حملة سياسية', value: 'political' },
  { label: 'منظمة غير ربحية', value: 'nonprofit' },
  { label: 'أخرى', value: 'other' },
]

/**
 * Display advertising. Each Ad represents a paid placement booked by a
 * business: contact info, creative (image + copy), placement, schedule,
 * and impression/click counters. Public reads return only active,
 * in-window ads via a dedicated /api/ads/active endpoint (in-row
 * collection access stays restricted to the editorial team).
 */
export const Ads: CollectionConfig = {
  slug: 'ads',
  labels: { singular: 'إعلان', plural: 'الإعلانات التجارية' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: [
      'name',
      'advertiser',
      'placement',
      'status',
      'startDate',
      'endDate',
      'impressions',
      'clicks',
    ],
    description:
      'إدارة الإعلانات التجارية. أنشئ إعلاناً جديداً عندما يطلب صاحب عمل النشر، حدد المكان، التاريخ، والصورة. يتحول لـ "منتهي الصلاحية" تلقائياً عند تجاوز تاريخ الانتهاء.',
    listSearchableFields: ['name', 'advertiser', 'contactPerson', 'contactEmail'],
    group: 'الأعمال',
  },
  defaultSort: '-createdAt',
  fields: [
    // -- Sidebar — operational state
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: STATUS_OPTIONS,
      index: true,
      label: 'الحالة',
      admin: {
        position: 'sidebar',
        description:
          'نشط: يظهر للقراء. مسودة: تحضير قبل التشغيل. متوقف: إيقاف مؤقت. منتهي: انتهت فترة العقد (يُضبط تلقائياً).',
      },
    },
    {
      name: 'placement',
      type: 'select',
      required: true,
      options: PLACEMENT_OPTIONS,
      index: true,
      label: 'مكان الظهور',
      admin: {
        position: 'sidebar',
        description: 'أين يظهر الإعلان على الموقع.',
      },
    },
    {
      name: 'startDate',
      type: 'date',
      required: true,
      label: 'تاريخ البدء',
      index: true,
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description: 'لن يظهر الإعلان قبل هذا الوقت.',
      },
    },
    {
      name: 'endDate',
      type: 'date',
      required: true,
      label: 'تاريخ الانتهاء',
      index: true,
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description: 'يختفي الإعلان تلقائياً بعد هذا التاريخ ويُحوَّل لحالة "منتهي الصلاحية".',
      },
    },
    {
      name: 'priority',
      type: 'number',
      defaultValue: 100,
      min: 1,
      max: 1000,
      label: 'الأولوية',
      admin: {
        position: 'sidebar',
        description:
          'إذا توفرت إعلانات متعددة لنفس المكان، يظهر الأعلى أولوية. الرقم الأصغر = أولوية أعلى. اتركه على 100 لمعظم الحالات.',
      },
    },

    // -- Live preview at the top
    {
      name: 'preview',
      type: 'ui',
      admin: {
        components: {
          Field: '/components/admin/AdPreview#AdPreview',
        },
      },
    },

    // -- Tabs — content + business details
    {
      type: 'tabs',
      tabs: [
        {
          label: 'الإعلان',
          description: 'الصورة والنص الذي يراه القارئ.',
          fields: [
            {
              name: 'name',
              type: 'text',
              required: true,
              label: 'اسم الإعلان (داخلي)',
              admin: {
                description: 'اسم تستخدمه أنت لتمييز الإعلان في القائمة. لا يظهر للقارئ.',
                placeholder: 'مثال: مطعم النور — رمضان 2026',
              },
            },
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              required: true,
              label: 'الصورة الرئيسية',
              admin: {
                description:
                  '📸 المقاس يعتمد على المكان. للبانر: 1200×200. للشريط الجانبي: 300×600. للوسط: 728×90 أو 970×90.',
              },
            },
            {
              name: 'imageMobile',
              type: 'upload',
              relationTo: 'media',
              label: 'صورة للهاتف (اختياري)',
              admin: {
                description:
                  'صورة مختلفة تظهر فقط للهواتف. اتركها فارغة لاستخدام الصورة الرئيسية على كل الأجهزة.',
              },
            },
            {
              name: 'headline',
              type: 'text',
              maxLength: 80,
              label: 'العنوان (اختياري)',
              admin: {
                description: 'إذا كان للإعلان نص فوق الصورة. اتركه فارغاً للصور التي تحتوي النص.',
                placeholder: 'افتتاح فرعنا الجديد!',
              },
            },
            {
              name: 'bodyText',
              type: 'textarea',
              maxLength: 200,
              label: 'وصف قصير (اختياري)',
              admin: {
                description: 'سطر أو اثنان يدعمان الصورة.',
              },
            },
            {
              name: 'ctaText',
              type: 'text',
              maxLength: 30,
              defaultValue: 'اعرف أكثر',
              label: 'نص الزر',
              admin: {
                description: 'النص على زر الإجراء. مثال: "اطلب الآن"، "تواصل معنا"، "زرنا".',
              },
            },
            {
              name: 'targetUrl',
              type: 'text',
              required: true,
              label: 'رابط الإعلان (الوجهة)',
              admin: {
                description:
                  'إلى أين ينتقل القارئ عند الضغط على الإعلان. ابدأ بـ https://. سيُفتح في نافذة جديدة.',
                placeholder: 'https://example.com',
              },
            },
            {
              name: 'sponsoredLabel',
              type: 'checkbox',
              defaultValue: true,
              label: 'إظهار شارة "إعلان"',
              admin: {
                description: '🚨 يجب أن تكون مفعّلة دائماً للشفافية مع القارئ ولأسباب قانونية.',
              },
            },
          ],
        },
        {
          label: 'المعلِن',
          description: 'بيانات صاحب العمل ووسائل التواصل معه.',
          fields: [
            {
              name: 'advertiser',
              type: 'text',
              required: true,
              label: 'اسم العمل / المعلِن',
              admin: {
                placeholder: 'مثال: مطعم النور',
              },
            },
            {
              name: 'advertiserType',
              type: 'select',
              options: ADVERTISER_TYPE_OPTIONS,
              defaultValue: 'shop',
              label: 'نوع العمل',
            },
            {
              name: 'contactPerson',
              type: 'text',
              label: 'الشخص المسؤول',
              admin: { placeholder: 'الشخص الذي تواصل معك' },
            },
            {
              name: 'contactEmail',
              type: 'email',
              label: 'البريد الإلكتروني',
            },
            {
              name: 'contactPhone',
              type: 'text',
              label: 'رقم الهاتف',
              admin: { placeholder: '+972...' },
            },
            {
              name: 'price',
              type: 'number',
              label: 'السعر (شيكل)',
              min: 0,
              admin: {
                description: 'السعر الإجمالي للحملة. للسجل المحاسبي.',
              },
            },
            {
              name: 'paid',
              type: 'checkbox',
              defaultValue: false,
              label: 'تم الدفع',
            },
            {
              name: 'invoiceNumber',
              type: 'text',
              label: 'رقم الفاتورة',
            },
            {
              name: 'notes',
              type: 'textarea',
              label: 'ملاحظات داخلية',
              admin: {
                description: 'ملاحظات حول العقد أو المعلِن — لا تظهر للقارئ.',
              },
            },
          ],
        },
        {
          label: 'الاستهداف',
          description: 'تحكم بمن يرى الإعلان وأين بالضبط.',
          fields: [
            {
              name: 'targetCategories',
              type: 'relationship',
              relationTo: 'categories',
              hasMany: true,
              label: 'تصنيفات محددة (اختياري)',
              admin: {
                description:
                  'إذا اخترت تصنيفات هنا، يظهر الإعلان فقط في صفحات تلك التصنيفات والمقالات المنتمية إليها. اتركها فارغة ليظهر في كل الموقع.',
              },
            },
          ],
        },
        {
          label: 'الإحصائيات',
          description: 'الأرقام تتحدث: مرات الظهور والضغط على الإعلان.',
          fields: [
            {
              name: 'impressions',
              type: 'number',
              defaultValue: 0,
              label: 'مرات الظهور',
              admin: {
                readOnly: true,
                description: 'عدد المرات التي شاهد فيها القراء الإعلان.',
              },
            },
            {
              name: 'clicks',
              type: 'number',
              defaultValue: 0,
              label: 'الضغطات',
              admin: {
                readOnly: true,
                description: 'عدد الضغطات على الإعلان.',
              },
            },
          ],
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (!data) return data
        // Auto-expire if endDate passed and status was active
        if (data.endDate && new Date(data.endDate) < new Date() && data.status === 'active') {
          data.status = 'expired'
        }
        return data
      },
    ],
    afterChange: [auditAfterChange],
    afterDelete: [auditAfterDelete],
  },
  access: {
    // Public reads happen through the dedicated /api/ads/active endpoint;
    // direct list reads stay restricted to staff so contact/billing details
    // never leak.
    read: ({ req }) => Boolean(req.user),
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
}
