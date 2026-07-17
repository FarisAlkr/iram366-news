import type { CollectionConfig } from 'payload'

import { isAdmin, isAdminOrEditor, isPublic } from '../access/index.ts'

/**
 * Audience push-notification subscriptions.
 *
 * One row per device that opted into notifications. For web (PWA) rows the
 * `endpoint` + `p256dh`/`auth` keys are the Web Push subscription; for the
 * future native app rows (`platform` ios/android) `endpoint` holds the
 * FCM/APNs token and the key fields stay empty.
 *
 * Created publicly from /api/push/subscribe (the browser opt-in flow), never
 * authored by hand. Like `page-views`, these are high-churn machine writes —
 * every subscribe, unsubscribe, and dead-endpoint prune — so the collection is
 * deliberately exempt from the audit hooks that wrap editorial collections;
 * auditing them would drown the audit log in device noise.
 */
export const PushSubscriptions: CollectionConfig = {
  slug: 'push-subscriptions',
  labels: { singular: 'اشتراك إشعارات', plural: 'اشتراكات الإشعارات' },
  admin: {
    useAsTitle: 'endpoint',
    defaultColumns: ['platform', 'topic', 'disabledAt', 'lastSeenAt', 'createdAt'],
    description:
      'أجهزة القراء المشتركة في إشعارات الدفع. تُنشأ تلقائياً عند موافقة القارئ على الإشعارات — لا تحرّر يدوياً.',
    listSearchableFields: ['endpoint'],
    group: 'النظام',
  },
  defaultSort: '-createdAt',
  fields: [
    {
      name: 'endpoint',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'العنوان (endpoint / token)',
    },
    {
      name: 'p256dh',
      type: 'text',
      label: 'مفتاح p256dh',
      admin: { description: 'مفتاح تشفير Web Push. فارغ لأجهزة التطبيق الأصلي.' },
    },
    {
      name: 'auth',
      type: 'text',
      label: 'مفتاح auth',
      admin: { description: 'مفتاح مصادقة Web Push. فارغ لأجهزة التطبيق الأصلي.' },
    },
    {
      name: 'platform',
      type: 'select',
      required: true,
      defaultValue: 'web',
      index: true,
      options: [
        { label: 'ويب (PWA)', value: 'web' },
        { label: 'آيفون (iOS)', value: 'ios' },
        { label: 'أندرويد', value: 'android' },
      ],
      label: 'المنصة',
    },
    {
      name: 'topic',
      type: 'select',
      required: true,
      defaultValue: 'all',
      index: true,
      options: [
        { label: 'كل المقالات', value: 'all' },
        { label: 'العاجل فقط', value: 'breaking' },
      ],
      label: 'التفضيل',
    },
    {
      name: 'userAgent',
      type: 'text',
      label: 'متصفح الجهاز',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'lastSeenAt',
      type: 'date',
      label: 'آخر ظهور',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description: 'يُحدّث عند إعادة تسجيل الجهاز للاشتراك.',
      },
    },
    {
      name: 'disabledAt',
      type: 'date',
      label: 'تاريخ الإيقاف',
      index: true,
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description:
          'يُضبط عند إلغاء القارئ للاشتراك أو عندما ترفض خدمة الدفع العنوان (منتهٍ). الصفوف الموقوفة تُستبعد من الإرسال.',
      },
    },
  ],
  access: {
    read: isAdminOrEditor,
    // Devices self-register via the public /api/push/subscribe flow.
    create: isPublic,
    update: isAdminOrEditor,
    delete: isAdmin,
  },
}
