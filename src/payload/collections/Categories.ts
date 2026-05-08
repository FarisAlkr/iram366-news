import type { CollectionConfig } from 'payload'

import { isAdminOrEditor, isPublic } from '../access/index.ts'
import { auditAfterChange, auditAfterDelete } from '../hooks/audit.ts'

export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: { singular: 'تصنيف', plural: 'التصنيفات' },
  admin: {
    useAsTitle: 'name',
    description:
      'التصنيفات تنظم المقالات وتظهر في القائمة العلوية للموقع (محلي، سياسة، رياضة، ...).',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      label: 'اسم التصنيف',
      admin: {
        description: 'الاسم الذي يظهر للقارئ في القائمة (مثال: محلي، سياسة، ثقافة).',
        placeholder: 'مثال: ثقافة',
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
        description:
          'رابط التصنيف في الموقع (إنجليزي بدون مسافات، مثل: local، politics). يجب أن يكون فريداً.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'الوصف',
      admin: {
        description:
          'وصف قصير للتصنيف يظهر أعلى صفحة التصنيف ويُستخدم في SEO. اختياري لكن مُوصى به.',
      },
    },
    {
      name: 'color',
      type: 'text',
      label: 'اللون',
      admin: {
        description:
          'لون سداسي (HEX) يُميّز التصنيف في الشارات على البطاقات. مثال: #c1121f للأحمر، #2563eb للأزرق.',
        placeholder: '#c8a84e',
      },
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'categories',
      label: 'التصنيف الأب',
      admin: {
        position: 'sidebar',
        description:
          'اتركه فارغاً للتصنيف الرئيسي. اختر تصنيفاً رئيسياً لتجعل هذا تصنيفاً فرعياً (مثلاً: سياسة → داخلية).',
      },
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 100,
      index: true,
      label: 'الترتيب',
      admin: {
        position: 'sidebar',
        description:
          'الرقم الأصغر يظهر أولاً في القائمة العلوية. اتركه على 100 إذا لم يكن للترتيب أهمية.',
      },
    },
  ],
  access: {
    read: isPublic,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  hooks: {
    afterChange: [auditAfterChange],
    afterDelete: [auditAfterDelete],
  },
}
