import type { CollectionConfig } from 'payload'

import { denied, isAdmin, isAdminOrEditor } from '../access/index.ts'

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
    // Rows are written by /api/articles/[slug]/view through the Local API
    // (which bypasses access). A public create let anyone POST
    // /api/page-views and inflate the stats.
    create: denied,
    update: isAdmin,
    delete: isAdmin,
  },
}
