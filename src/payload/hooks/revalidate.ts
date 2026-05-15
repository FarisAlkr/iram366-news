import { revalidatePath, revalidateTag } from 'next/cache'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { CacheTags } from '../../lib/queries.ts'
import { logger } from '../../lib/logger.ts'

/**
 * Cache-invalidation hooks for Payload mutations.
 *
 * Background: src/lib/queries.ts wraps a few hot reads in
 * `unstable_cache` with named tags (`CacheTags.Categories`, etc.) and
 * the homepage / article page use ISR via `export const revalidate`.
 * Without explicit invalidation, an admin edit takes up to 5 minutes
 * (the unstable_cache TTL) or one ISR cycle (60–120s) to surface
 * publicly. Editors notice and report "I changed it, nothing happened".
 *
 * These hooks call the right `revalidateTag` / `revalidatePath` so
 * mutations propagate within seconds. Failures are logged but never
 * thrown — a transient cache-invalidation glitch must not roll back
 * the mutation itself.
 */

function safeRevalidate(fn: () => void, ctx: Record<string, unknown>): void {
  try {
    fn()
  } catch (err) {
    logger.warn('revalidate.failed', { ...ctx, err })
  }
}

/** Categories: invalidate the cached list + every page that renders the nav. */
export const revalidateCategoriesAfterChange: CollectionAfterChangeHook = ({ doc, operation }) => {
  safeRevalidate(() => revalidateTag(CacheTags.Categories), {
    hook: 'categories.afterChange',
    operation,
    docId: (doc as { id?: number | string })?.id,
  })
  // The header nav and the per-category section on the homepage both
  // read getCategories() — invalidate the homepage so the new entry
  // shows up on the next visit instead of the next ISR tick.
  safeRevalidate(() => revalidatePath('/'), {
    hook: 'categories.afterChange',
    path: '/',
  })
  const slug = (doc as { slug?: string })?.slug
  if (slug) {
    safeRevalidate(() => revalidatePath(`/category/${slug}`), {
      hook: 'categories.afterChange',
      path: `/category/${slug}`,
    })
  }
}

export const revalidateCategoriesAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
  safeRevalidate(() => revalidateTag(CacheTags.Categories), {
    hook: 'categories.afterDelete',
  })
  safeRevalidate(() => revalidatePath('/'), {
    hook: 'categories.afterDelete',
    path: '/',
  })
  const slug = (doc as { slug?: string } | undefined)?.slug
  if (slug) {
    safeRevalidate(() => revalidatePath(`/category/${slug}`), {
      hook: 'categories.afterDelete',
      path: `/category/${slug}`,
    })
  }
}

/**
 * Articles: invalidate the homepage (latest list + per-category sections
 * + breaking ticker), the article's own page, and the article's category
 * index. Drafts and archived rows still touch the homepage's cache
 * because a status transition either adds or removes them from the
 * public set.
 */
export const revalidateArticlesAfterChange: CollectionAfterChangeHook = ({
  doc,
  previousDoc,
  operation,
}) => {
  const docTyped = doc as {
    id?: number | string
    slug?: string
    category?: { slug?: string } | string | number
  }
  const prevTyped = previousDoc as
    | { slug?: string; category?: { slug?: string } | string | number }
    | undefined

  safeRevalidate(() => revalidatePath('/'), {
    hook: 'articles.afterChange',
    path: '/',
    operation,
    docId: docTyped.id,
  })

  if (docTyped.slug) {
    safeRevalidate(() => revalidatePath(`/articles/${docTyped.slug}`), {
      hook: 'articles.afterChange',
      path: `/articles/${docTyped.slug}`,
    })
  }
  // Slug renames: invalidate the old path too so a stale ISR entry
  // doesn't keep serving the moved article at its previous URL.
  if (prevTyped?.slug && prevTyped.slug !== docTyped.slug) {
    safeRevalidate(() => revalidatePath(`/articles/${prevTyped.slug}`), {
      hook: 'articles.afterChange',
      path: `/articles/${prevTyped.slug}`,
    })
  }

  const catSlug =
    typeof docTyped.category === 'object' && docTyped.category ? docTyped.category.slug : undefined
  if (catSlug) {
    safeRevalidate(() => revalidatePath(`/category/${catSlug}`), {
      hook: 'articles.afterChange',
      path: `/category/${catSlug}`,
    })
  }
  // Category change: previous category's index also stale.
  const prevCatSlug =
    typeof prevTyped?.category === 'object' && prevTyped.category
      ? prevTyped.category.slug
      : undefined
  if (prevCatSlug && prevCatSlug !== catSlug) {
    safeRevalidate(() => revalidatePath(`/category/${prevCatSlug}`), {
      hook: 'articles.afterChange',
      path: `/category/${prevCatSlug}`,
    })
  }
}

export const revalidateArticlesAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
  const docTyped = doc as
    | { slug?: string; category?: { slug?: string } | string | number }
    | undefined
  safeRevalidate(() => revalidatePath('/'), {
    hook: 'articles.afterDelete',
    path: '/',
  })
  if (docTyped?.slug) {
    safeRevalidate(() => revalidatePath(`/articles/${docTyped.slug}`), {
      hook: 'articles.afterDelete',
      path: `/articles/${docTyped.slug}`,
    })
  }
  const catSlug =
    typeof docTyped?.category === 'object' && docTyped.category ? docTyped.category.slug : undefined
  if (catSlug) {
    safeRevalidate(() => revalidatePath(`/category/${catSlug}`), {
      hook: 'articles.afterDelete',
      path: `/category/${catSlug}`,
    })
  }
}
