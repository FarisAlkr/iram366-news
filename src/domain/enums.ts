/**
 * Domain-level enums.
 *
 * Use `as const` objects rather than TypeScript enums — they erase cleanly
 * to plain string literals at runtime and play well with Payload's `select`
 * field option values.
 */

export const ArticleStatus = {
  Draft: 'draft',
  InReview: 'in-review',
  Published: 'published',
  Archived: 'archived',
} as const
export type ArticleStatus = (typeof ArticleStatus)[keyof typeof ArticleStatus]

export const ARTICLE_STATUSES: ArticleStatus[] = [
  ArticleStatus.Draft,
  ArticleStatus.InReview,
  ArticleStatus.Published,
  ArticleStatus.Archived,
]

export const UserRole = {
  Admin: 'admin',
  Editor: 'editor',
  Author: 'author',
} as const
export type UserRole = (typeof UserRole)[keyof typeof UserRole]

export const AuditAction = {
  Create: 'create',
  Update: 'update',
  Delete: 'delete',
} as const
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction]

export const HeroMode = {
  Auto: 'auto',
  Manual: 'manual',
} as const
export type HeroMode = (typeof HeroMode)[keyof typeof HeroMode]
