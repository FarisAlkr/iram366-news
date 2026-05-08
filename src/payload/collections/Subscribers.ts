import type { CollectionConfig } from 'payload'

import { isAdminOrEditor, isPublic } from '../access/index.ts'

export const Subscribers: CollectionConfig = {
  slug: 'subscribers',
  labels: { singular: 'مشترك', plural: 'مشتركو النشرة' },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'verifiedAt', 'unsubscribedAt', 'source', 'createdAt'],
    description:
      'قائمة بريدية للمشتركين في النشرة الإخبارية. تنشأ تلقائياً من نموذج الاشتراك في الموقع. لا تحرّر يدوياً.',
    listSearchableFields: ['email'],
    group: 'النظام',
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      index: true,
      label: 'البريد الإلكتروني',
    },
    {
      name: 'verifiedAt',
      type: 'date',
      label: 'تاريخ التأكيد',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description:
          'يُضبط تلقائياً عندما ينقر المشترك على رابط التأكيد في البريد الترحيبي.',
      },
    },
    {
      name: 'unsubscribedAt',
      type: 'date',
      label: 'تاريخ إلغاء الاشتراك',
      index: true,
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description: 'يُضبط تلقائياً إذا أوقف المشترك الاشتراك.',
      },
    },
    {
      name: 'source',
      type: 'text',
      label: 'المصدر',
      defaultValue: 'website',
      admin: {
        position: 'sidebar',
        description: 'من أين اشترك (footer / popup / article-end / api).',
      },
    },
    {
      name: 'preferences',
      type: 'group',
      label: 'التفضيلات',
      fields: [
        {
          name: 'frequency',
          type: 'select',
          defaultValue: 'weekly',
          options: [
            { label: 'يومي', value: 'daily' },
            { label: 'أسبوعي', value: 'weekly' },
            { label: 'فقط عاجل', value: 'breaking' },
          ],
          label: 'تكرار الإرسال',
        },
      ],
    },
  ],
  access: {
    read: isAdminOrEditor,
    // Subscriptions are created via a public newsletter form; restrict
    // direct admin reads to staff but accept public POSTs.
    create: isPublic,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
}
