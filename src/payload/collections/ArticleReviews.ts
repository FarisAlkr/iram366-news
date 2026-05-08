import type { CollectionConfig } from 'payload'

import { isAdminOrEditor, isAuthenticated } from '../access/index.ts'
import { notifyOnReviewCreated } from '../hooks/notify.ts'

const STATUS_OPTIONS = [
  { label: 'مفتوح', value: 'open' },
  { label: 'تمت معالجته', value: 'resolved' },
]

/**
 * Editor feedback / review comments per article. An editor reviewing a
 * submitted article (status=in-review) leaves notes here for the author —
 * what to fix, what's strong, etc. The author sees them in their
 * notifications and on the article edit page.
 *
 * When status flips to "resolved", the review is considered addressed.
 */
export const ArticleReviews: CollectionConfig = {
  slug: 'article-reviews',
  labels: { singular: 'مراجعة', plural: 'مراجعات تحريرية' },
  admin: {
    useAsTitle: 'summary',
    defaultColumns: ['summary', 'article', 'reviewer', 'status', 'createdAt'],
    description:
      'تعليقات تحريرية على المقالات — يستخدمها المحررون لإرسال ملاحظات للكتّاب قبل النشر.',
    listSearchableFields: ['summary', 'content'],
    group: 'النظام',
  },
  defaultSort: '-createdAt',
  fields: [
    {
      name: 'article',
      type: 'relationship',
      relationTo: 'articles',
      required: true,
      index: true,
      label: 'المقال',
    },
    {
      name: 'reviewer',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      label: 'المحرر',
      admin: {
        description: 'يُعيَّن تلقائياً للمستخدم الحالي عند الإنشاء.',
      },
    },
    {
      name: 'summary',
      type: 'text',
      required: true,
      label: 'العنوان الموجز',
      admin: {
        description: 'سطر واحد يلخّص الملاحظة (يظهر في القائمة).',
        placeholder: 'مثال: راجع الأرقام في الفقرة الثالثة',
      },
    },
    {
      name: 'content',
      type: 'textarea',
      required: true,
      label: 'الملاحظة الكاملة',
      admin: {
        description: 'شرح تفصيلي للمحرر — ما الذي يحتاج إلى تعديل ولماذا.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'open',
      options: STATUS_OPTIONS,
      index: true,
      label: 'الحالة',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'resolvedAt',
      type: 'date',
      label: 'تاريخ المعالجة',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        readOnly: true,
        description: 'يُضبط تلقائياً عند تغيير الحالة إلى "تمت معالجته".',
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        if (!data) return data
        // Auto-assign reviewer on create
        if (operation === 'create' && req.user) {
          data.reviewer = req.user.id
        }
        // Stamp resolvedAt when status flips to 'resolved'
        if (data.status === 'resolved' && !data.resolvedAt) {
          data.resolvedAt = new Date().toISOString()
        }
        return data
      },
    ],
    afterChange: [notifyOnReviewCreated],
  },
  access: {
    read: isAuthenticated,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
}
