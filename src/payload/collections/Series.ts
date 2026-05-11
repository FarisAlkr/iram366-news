import type { CollectionConfig } from 'payload'

import { ensureSlug } from '../../lib/slug.ts'
import { isAdminOrEditor, isPublic } from '../access/index.ts'
import { auditAfterChange, auditAfterDelete } from '../hooks/audit.ts'

const STATUS_OPTIONS = [
  { label: 'نشطة', value: 'active' },
  { label: 'مؤرشفة', value: 'archived' },
]

export const Series: CollectionConfig = {
  slug: 'series',
  labels: { singular: 'سلسلة', plural: 'السلاسل والملفات' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'status', 'updatedAt'],
    description:
      'مجموعات من المقالات المرتبطة (مثل: "ملف خاص: انتخابات 2026"). تربط المقالات معاً لعرضها كسلسلة.',
    listSearchableFields: ['name', 'description'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'اسم السلسلة',
      admin: {
        description: 'العنوان الذي يظهر للقارئ في صفحة السلسلة وفي بطاقات المقالات.',
        placeholder: 'مثال: ملف خاص — انتخابات 2026',
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
        description: 'الرابط النهائي للسلسلة (يُنشأ تلقائياً من الاسم). تجنب تغييره بعد النشر.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: STATUS_OPTIONS,
      label: 'الحالة',
      admin: {
        position: 'sidebar',
        description: 'نشطة: تظهر في الموقع وتقبل مقالات جديدة. مؤرشفة: مخفية لكن محفوظة.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'الوصف',
      admin: {
        description: 'وصف قصير للسلسلة يظهر أعلى صفحتها ويُستخدم في SEO.',
      },
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
      label: 'صورة الغلاف',
      admin: {
        description: 'صورة تمثل السلسلة بأكملها. مقاس مُوصى به: 1200×630.',
      },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        if (!data) return data
        if (operation === 'create' && data.name && !data.slug) {
          data.slug = ensureSlug(data.name)
        }
        return data
      },
    ],
    afterChange: [auditAfterChange],
    afterDelete: [auditAfterDelete],
  },
  access: {
    read: isPublic,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
}
