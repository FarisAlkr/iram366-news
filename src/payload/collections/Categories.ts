import { APIError, type CollectionConfig } from 'payload'

import { isAdminOrEditor, isPublic } from '../access/index.ts'
import { auditAfterChange, auditAfterDelete } from '../hooks/audit.ts'
import {
  revalidateCategoriesAfterChange,
  revalidateCategoriesAfterDelete,
} from '../hooks/revalidate.ts'

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
    // Without this guard, deleting a category with articles assigned to it
    // hits a Postgres NOT-NULL violation on articles.category_id (the FK is
    // SET NULL but the column is NOT NULL — incompatible) and surfaces as
    // an opaque 500 in the admin. Block the delete with a friendly Arabic
    // message instead, telling the editor to rename the category rather
    // than delete it.
    beforeDelete: [
      async ({ id, req }) => {
        const { totalDocs } = await req.payload.count({
          collection: 'articles',
          where: { category: { equals: id } },
        })
        if (totalDocs > 0) {
          throw new APIError(
            'هذا التصنيف يحتوي على مقالات ولا يمكن حذفه. حاول تغيير اسمه بدلاً من ذلك.',
            400,
          )
        }
      },
    ],
    afterChange: [auditAfterChange, revalidateCategoriesAfterChange],
    afterDelete: [auditAfterDelete, revalidateCategoriesAfterDelete],
  },
}
