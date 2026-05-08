import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/index.ts'

const NOTIFICATION_TYPES = [
  { label: 'تم نشر المقال', value: 'article.published' },
  { label: 'مقال بانتظار المراجعة', value: 'article.in-review' },
  { label: 'تمت إعادة المقال للمسودات', value: 'article.rejected' },
  { label: 'مقال مجدول قارب موعد النشر', value: 'article.publish-soon' },
  { label: 'تعليق محرر جديد', value: 'review.created' },
  { label: 'إعلان من النظام', value: 'system' },
]

/**
 * Per-user notifications — surfaced in the admin via the bell dropdown
 * and as items in this collection's list view. Created automatically by
 * hooks (article publish, scheduled publish, review submitted) and never
 * manually authored. Read-only for everyone except the recipient.
 */
export const Notifications: CollectionConfig = {
  slug: 'notifications',
  labels: { singular: 'إشعار', plural: 'الإشعارات' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'recipient', 'readAt', 'createdAt'],
    description:
      'إشعارات النظام التلقائية لكل مستخدم. تظهر في جرس الإشعارات أعلى الصفحة. تُنشأ تلقائياً ولا تحرَّر يدوياً.',
    listSearchableFields: ['title', 'message'],
    group: 'النظام',
  },
  defaultSort: '-createdAt',
  fields: [
    {
      name: 'recipient',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      label: 'المستلم',
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: NOTIFICATION_TYPES,
      defaultValue: 'system',
      index: true,
      label: 'النوع',
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'العنوان',
    },
    {
      name: 'message',
      type: 'textarea',
      label: 'الرسالة',
    },
    {
      name: 'link',
      type: 'text',
      label: 'الرابط داخل لوحة التحكم',
      admin: { placeholder: '/admin/collections/articles/123' },
    },
    {
      name: 'relatedArticle',
      type: 'relationship',
      relationTo: 'articles',
      label: 'المقال المرتبط',
    },
    {
      name: 'readAt',
      type: 'date',
      label: 'وقت القراءة',
      index: true,
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description: 'يُضبط تلقائياً عندما يفتح المستخدم الإشعار.',
      },
    },
  ],
  access: {
    // Recipients can read their own; admins can read all
    read: ({ req }) => {
      if (req.user?.role === 'admin') return true
      if (!req.user) return false
      return { recipient: { equals: req.user.id } } as never
    },
    // Notifications are created by hooks (server-side); restrict manual create
    create: isAdmin,
    update: ({ req }) => {
      // Recipient can mark their own as read; admin full access
      if (req.user?.role === 'admin') return true
      if (!req.user) return false
      return { recipient: { equals: req.user.id } } as never
    },
    delete: isAdmin,
  },
}
