/**
 * Reusable Payload access-control helpers.
 *
 * One source of truth for role-based predicates so collections stay readable
 * and a role change cannot drift between files.
 */

import type { Access, AccessArgs } from 'payload'
import { UserRole } from '../../domain/enums.ts'

type Req = AccessArgs['req']

const role = (req: Req): UserRole | undefined =>
  (req.user?.role as UserRole | undefined) ?? undefined

export const isAdmin: Access = ({ req }) => role(req) === UserRole.Admin

export const isEditor: Access = ({ req }) => role(req) === UserRole.Editor

export const isAuthor: Access = ({ req }) => role(req) === UserRole.Author

export const isAdminOrEditor: Access = ({ req }) => {
  const r = role(req)
  return r === UserRole.Admin || r === UserRole.Editor
}

export const isAuthenticated: Access = ({ req }) => Boolean(req.user)

export const isPublic: Access = () => true

export const denied: Access = () => false

/**
 * Owner-or-admin/editor: admin/editor see all, author sees only their own.
 * Returns a Where filter for narrowing rather than a boolean — Payload uses
 * this to scope list queries.
 */
export const isOwnerOrAdminEditor =
  (ownerField = 'author'): Access =>
  ({ req }) => {
    const r = role(req)
    if (r === UserRole.Admin || r === UserRole.Editor) return true
    if (!req.user) return false
    if (r === UserRole.Author) {
      return { [ownerField]: { equals: req.user.id } }
    }
    return false
  }
