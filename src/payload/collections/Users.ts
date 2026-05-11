import type { CollectionConfig } from 'payload'

import { UserRole } from '../../domain/enums.ts'
import { isAdmin, isAdminOrEditor } from '../access/index.ts'
import { auditAfterChange, auditAfterDelete } from '../hooks/audit.ts'

const ROLE_OPTIONS: Array<{ label: string; value: UserRole }> = [
  { label: 'مدير', value: UserRole.Admin },
  { label: 'محرر', value: UserRole.Editor },
  { label: 'كاتب', value: UserRole.Author },
]

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    // 1 year — keep editorial users logged in indefinitely on personal
    // devices. Combined with the sliding-session cookie refresh in the
    // mobile dashboard (see app/(mobile)/m/auth.ts), every visit extends
    // the cookie by another year, so a regular user effectively never has
    // to re-login.
    tokenExpiration: 60 * 60 * 24 * 365,
    // Account-level brute-force defense. After 5 failed logins, Payload
    // locks the account for 10 minutes regardless of which IP retries —
    // pairs with the network-level enforce() limit in the mobile login
    // action to defend against both single-IP and distributed attacks.
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,
  },
  labels: { singular: 'مستخدم', plural: 'المستخدمون' },
  admin: {
    useAsTitle: 'name',
    description: 'حسابات المحررين والكتّاب. المدير وحده يمكنه إنشاء حسابات جديدة وتعيين الأدوار.',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'الاسم',
      admin: {
        description: 'الاسم الكامل للمستخدم كما يظهر على المقالات التي يكتبها.',
        placeholder: 'مثال: آدم الطوري',
      },
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: UserRole.Editor,
      options: ROLE_OPTIONS,
      label: 'الدور',
      admin: {
        description:
          'مدير: صلاحيات كاملة (مستخدم واحد فقط). محرر: يكتب وينشر ويعدّل أي مقال. كاتب: يكتب مسودات فقط تحتاج لموافقة المحرر.',
      },
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
      label: 'الصورة الشخصية',
      admin: {
        description:
          'صورة شخصية للمستخدم تظهر بجانب اسمه في المقالات. مُوصى بصورة مربعة (مثلاً 200×200 بكسل).',
      },
    },
    {
      name: 'position',
      type: 'text',
      label: 'المنصب أو التخصص',
      admin: {
        description:
          'المسمى الوظيفي للمحرر/الكاتب (مثل: محرر السياسة، مراسل ميداني). يظهر بجانب الاسم في المقال.',
        placeholder: 'مثال: محرر السياسة',
      },
    },
    {
      name: 'bio',
      type: 'textarea',
      maxLength: 500,
      label: 'نبذة شخصية',
      admin: {
        description:
          'نبذة قصيرة عن المستخدم (سطران أو ثلاثة) تظهر في صفحة الكاتب أسفل قائمة مقالاته.',
        placeholder: 'صحفي مهتم بقضايا التعليم والشباب في النقب...',
      },
    },
    {
      name: 'twitter',
      type: 'text',
      label: 'حساب تويتر/X',
      admin: {
        description: 'اسم المستخدم بدون @. يظهر كرابط في صفحة الكاتب.',
        placeholder: 'iram366news',
      },
    },
    {
      name: 'joinedAt',
      type: 'date',
      label: 'تاريخ الانضمام',
      defaultValue: () => new Date().toISOString(),
      index: true,
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayOnly' },
        readOnly: true,
        description: 'يُضبط تلقائياً عند إنشاء الحساب.',
      },
    },
    {
      name: 'deletedAt',
      type: 'date',
      label: 'تاريخ الحذف (السلة)',
      index: true,
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description:
          'إذا ضُبطت قيمة هنا يصبح الحساب في "سلة المحذوفات" — مخفي من الموقع لكن البيانات والمقالات السابقة محفوظة. اتركها فارغة للحساب النشط.',
      },
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, operation, req }) => {
        if (!data || data.role !== UserRole.Admin) return data

        // Single-admin enforcement. Note: this is best-effort at the
        // application layer; a Postgres partial unique index on
        // role='admin' is the durable backstop and is documented in
        // deploy/RUNBOOK.md.
        const existing = await req.payload.find({
          collection: 'users',
          where: { role: { equals: UserRole.Admin } },
          limit: 1,
        })

        if (operation === 'create' && existing.totalDocs > 0) {
          throw new Error('يوجد مدير واحد بالفعل — لا يمكن إنشاء مدير آخر')
        }

        if (operation === 'update' && existing.totalDocs > 0) {
          const existingAdmin = existing.docs[0]
          if (existingAdmin && existingAdmin.id !== data.id) {
            throw new Error('يوجد مدير واحد بالفعل — لا يمكن تعيين مدير آخر')
          }
        }

        return data
      },
    ],
    afterChange: [auditAfterChange],
    afterDelete: [auditAfterDelete],
  },
  access: {
    read: isAdminOrEditor,
    create: isAdmin,
    update: isAdminOrEditor,
    delete: isAdmin,
  },
}
