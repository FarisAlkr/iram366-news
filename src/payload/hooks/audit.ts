/**
 * Audit-log hook factory.
 *
 * Wires every collection's create/update/delete events into the `audit-log`
 * collection. Failures are non-fatal — auditing must never block a user
 * action — but they are logged at error level so silent breakage is visible
 * in production logs.
 */

import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  PayloadRequest,
} from 'payload'
import { AuditAction } from '../../domain/enums.ts'
import { logger } from '../../lib/logger.ts'

const SKIP_COLLECTIONS = new Set(['audit-log', 'page-views'])

interface SummarizableDoc {
  id?: string | number
  title?: string
  name?: string
  email?: string
  filename?: string
  alt?: string
  status?: string
  role?: string
}

function summarize(doc: SummarizableDoc | undefined, collection: string): string {
  if (!doc) return ''
  switch (collection) {
    case 'articles':
      return `${doc.title || 'بدون عنوان'} (${doc.status || '-'})`
    case 'users':
      return `${doc.name || doc.email || 'مستخدم'} — ${doc.role || '-'}`
    case 'categories':
      return doc.name || 'تصنيف'
    case 'media':
      return doc.filename || doc.alt || 'وسائط'
    case 'pages':
      return doc.title || 'صفحة'
    default:
      return String(doc.id ?? '')
  }
}

async function writeLog(
  req: PayloadRequest,
  action: AuditAction,
  collection: string,
  docId: number | string,
  summary: string,
): Promise<void> {
  if (SKIP_COLLECTIONS.has(collection)) return
  if (!req?.payload) return

  try {
    await req.payload.create({
      collection: 'audit-log',
      data: {
        action,
        targetCollection: collection,
        targetId: String(docId),
        user: req.user?.id ?? null,
        userName: req.user?.name || req.user?.email || 'النظام',
        summary,
      },
    })
  } catch (err) {
    // Auditing must not break user actions — but we want failures to be
    // visible in logs/alerting, not silently swallowed.
    logger.error('audit.write_failed', {
      err,
      action,
      collection,
      docId: String(docId),
      userId: req.user?.id ?? null,
    })
  }
}

export const auditAfterChange: CollectionAfterChangeHook = async ({
  doc,
  req,
  operation,
  collection,
}) => {
  const action = operation === 'create' ? AuditAction.Create : AuditAction.Update
  await writeLog(req, action, collection.slug, doc.id, summarize(doc, collection.slug))
  return doc
}

export const auditAfterDelete: CollectionAfterDeleteHook = async ({
  doc,
  req,
  collection,
  id,
}) => {
  await writeLog(
    req,
    AuditAction.Delete,
    collection.slug,
    id,
    summarize(doc, collection.slug),
  )
}
