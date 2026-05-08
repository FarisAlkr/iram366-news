import type { CollectionConfig } from 'payload'

import { isAdmin, isPublic } from '../access/index.ts'
import { auditAfterChange, auditAfterDelete } from '../hooks/audit.ts'

export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'صفحة', plural: 'الصفحات الثابتة' },
  admin: {
    useAsTitle: 'title',
    description:
      'الصفحات الثابتة مثل "من نحن"، "سياسة الخصوصية"، و"اتصل بنا". لا تُعرض في قسم الأخبار.',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'العنوان',
      admin: {
        description: 'اسم الصفحة (مثال: من نحن، سياسة الخصوصية، اتصل بنا).',
        placeholder: 'مثال: من نحن',
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
        description:
          'رابط الصفحة في الموقع (إنجليزي بدون مسافات). مثال: about، privacy، contact.',
        placeholder: 'about',
      },
    },
    {
      name: 'body',
      type: 'richText',
      label: 'المحتوى',
      admin: {
        description: 'محتوى الصفحة بصيغة نص منسّق (عناوين، فقرات، روابط، قوائم).',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'تاريخ النشر',
      admin: { description: 'تاريخ نشر الصفحة. اختياري.' },
    },
  ],
  access: {
    read: isPublic,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    afterChange: [auditAfterChange],
    afterDelete: [auditAfterDelete],
  },
}
