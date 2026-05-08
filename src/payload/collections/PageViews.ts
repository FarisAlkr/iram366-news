import type { CollectionConfig } from 'payload'

import { isAdmin, isAdminOrEditor, isPublic } from '../access/index.ts'

export const PageViews: CollectionConfig = {
  slug: 'page-views',
  labels: { singular: 'مشاهدة', plural: 'سجل المشاهدات' },
  admin: {
    hidden: true,
    useAsTitle: 'id',
  },
  fields: [
    {
      name: 'article',
      type: 'relationship',
      relationTo: 'articles',
      required: true,
      index: true,
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      index: true,
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      index: true,
    },
  ],
  access: {
    read: isAdminOrEditor,
    create: isPublic, // Anonymous tracking from /api/articles/[slug]/view
    update: isAdmin,
    delete: isAdmin,
  },
}
