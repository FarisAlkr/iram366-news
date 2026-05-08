import type { CollectionConfig } from 'payload'

import { AuditAction } from '../../domain/enums.ts'
import { denied, isAdmin, isPublic } from '../access/index.ts'

const ACTION_OPTIONS: Array<{ label: string; value: AuditAction }> = [
  { label: 'إنشاء', value: AuditAction.Create },
  { label: 'تعديل', value: AuditAction.Update },
  { label: 'حذف', value: AuditAction.Delete },
]

export const AuditLog: CollectionConfig = {
  slug: 'audit-log',
  labels: { singular: 'سجل', plural: 'سجل الأحداث' },
  admin: {
    useAsTitle: 'summary',
    defaultColumns: ['createdAt', 'action', 'targetCollection', 'userName', 'summary'],
    description:
      'سجل كامل لكل عملية تم تنفيذها على النظام — لا يمكن تعديله. استخدمه لتتبع من غيّر ماذا ومتى.',
    group: 'النظام',
  },
  defaultSort: '-createdAt',
  fields: [
    {
      name: 'action',
      type: 'select',
      required: true,
      options: ACTION_OPTIONS,
      label: 'الإجراء',
    },
    {
      name: 'targetCollection',
      type: 'text',
      required: true,
      index: true,
      label: 'نوع المحتوى',
    },
    {
      name: 'targetId',
      type: 'text',
      required: true,
      index: true,
      label: 'معرّف العنصر',
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      label: 'المستخدم',
    },
    {
      name: 'userName',
      type: 'text',
      label: 'اسم المستخدم (لقطة)',
      admin: {
        description: 'يُحفظ الاسم وقت الحدث حتى لو حُذف المستخدم لاحقاً.',
      },
    },
    {
      name: 'summary',
      type: 'text',
      label: 'الملخّص',
    },
  ],
  access: {
    read: isAdmin,
    create: isPublic, // Hooks bypass via overrideAccess; this allows the audit hook itself.
    update: denied,
    delete: isAdmin,
  },
  timestamps: true,
}
