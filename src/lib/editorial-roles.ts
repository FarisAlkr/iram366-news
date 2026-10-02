/**
 * Editorial workflow rules shared by the Articles hooks, the mobile
 * composer and the hero-placement endpoint. Authors (كاتب) write; editors
 * and the admin publish and curate the homepage — see the role
 * descriptions in Users.ts.
 */
import { ArticleStatus, UserRole } from '../domain/enums.ts'

export function canPublishDirectly(role: unknown): boolean {
  return role === UserRole.Admin || role === UserRole.Editor
}

/** Homepage hero curation follows the same line as publishing. */
export const canPlaceHero = canPublishDirectly

/**
 * The status an article is actually saved with. An author asking to publish
 * submits it for review instead; everything else passes through.
 */
export function effectiveStatus<S extends string>(role: unknown, requested: S): S | 'in-review' {
  if (requested === ArticleStatus.Published && !canPublishDirectly(role)) {
    return ArticleStatus.InReview
  }
  return requested
}
