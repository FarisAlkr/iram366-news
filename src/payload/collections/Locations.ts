import type { CollectionConfig } from 'payload'

import { ensureSlug } from '../../lib/slug.ts'
import { isAdminOrEditor, isPublic } from '../access/index.ts'
import { auditAfterChange, auditAfterDelete } from '../hooks/audit.ts'

const LOCATION_TYPES = [
  { label: 'حي/منطقة', value: 'neighborhood' },
  { label: 'مدينة', value: 'city' },
  { label: 'منطقة جغرافية', value: 'region' },
  { label: 'دولة', value: 'country' },
  { label: 'موقع آخر', value: 'other' },
]

export const Locations: CollectionConfig = {
  slug: 'locations',
  labels: { singular: 'موقع', plural: 'المواقع' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'nameEn', 'updatedAt'],
    description:
      'المواقع الجغرافية المذكورة في المقالات (رهط، النقب، القدس، ...). تستخدم لتصنيف المقالات جغرافياً وعرضها على خرائط.',
    listSearchableFields: ['name', 'nameEn', 'slug'],
    group: 'التصنيفات',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'الاسم بالعربية',
      admin: {
        description: 'الاسم كما يكتب بالعربية (مثل: رهط، النقب).',
        placeholder: 'مثال: رهط',
      },
    },
    {
      name: 'nameEn',
      type: 'text',
      label: 'الاسم بالإنجليزية',
      admin: {
        description: 'الاسم بالإنجليزية للاستخدام في SEO وعند المشاركة الدولية.',
        placeholder: 'مثال: Rahat',
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'city',
      options: LOCATION_TYPES,
      label: 'النوع',
      admin: {
        position: 'sidebar',
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
        description: 'الرابط النهائي لصفحة الموقع.',
      },
    },
    {
      name: 'coordinates',
      type: 'group',
      label: 'الإحداثيات (اختياري)',
      admin: {
        description: 'إحداثيات GPS — تستخدم لعرض المواقع على خريطة.',
      },
      fields: [
        {
          name: 'lat',
          type: 'number',
          label: 'خط العرض',
          admin: { placeholder: '31.3927', step: 0.0001 },
        },
        {
          name: 'lng',
          type: 'number',
          label: 'خط الطول',
          admin: { placeholder: '34.7544', step: 0.0001 },
        },
      ],
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        if (!data) return data
        if (operation === 'create' && data.name && !data.slug) {
          data.slug = ensureSlug(data.nameEn || data.name)
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
