/**
 * Homepage hero placement (Main / Secondary 1-3 / None) for one article.
 *
 * Shared by POST /api/admin/hero-placement (desktop picker) and the mobile
 * composer so the merge rules can't drift. The site-settings global is
 * admin-only; editors are allowed to curate the hero, so the write is
 * elevated with overrideAccess and touches `homepageHero` only. Callers
 * must check `canPlaceHero(role)` first.
 */
import type { Payload } from 'payload'

import { HeroMode } from '../domain/enums.ts'

export type HeroPlacement = 'main' | 'secondary-1' | 'secondary-2' | 'secondary-3' | 'none'

export const HERO_PLACEMENTS: ReadonlyArray<HeroPlacement> = [
  'main',
  'secondary-1',
  'secondary-2',
  'secondary-3',
  'none',
]

export function isHeroPlacement(value: unknown): value is HeroPlacement {
  return typeof value === 'string' && (HERO_PLACEMENTS as readonly string[]).includes(value)
}

type Id = string | number

export interface StoredHero {
  mode?: string | null
  mainArticle?: unknown
  secondaryArticles?: unknown[] | null
}

export interface HeroValue {
  mode: typeof HeroMode.Manual
  mainArticle: Id | null
  secondaryArticles: Id[]
}

function refId(ref: unknown): Id | null {
  if (ref == null) return null
  if (typeof ref === 'object' && 'id' in ref) return (ref as { id: Id }).id
  if (typeof ref === 'string' || typeof ref === 'number') return ref
  return null
}

// Postgres ids are numbers; request bodies may carry them as strings.
const toId = (id: Id): Id => (typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : id)
const same = (a: Id | null, b: Id) => a != null && String(a) === String(b)

/** Pure: the homepageHero value after placing `articleId` at `placement`. */
export function placeInHero(
  current: StoredHero,
  articleId: Id,
  placement: HeroPlacement,
): HeroValue {
  const id = toId(articleId)
  let mainArticle = refId(current.mainArticle)
  let secondaryArticles = (current.secondaryArticles ?? [])
    .map(refId)
    .filter((x): x is Id => x != null && !same(x, id))

  if (placement === 'main') {
    mainArticle = id
  } else {
    if (same(mainArticle, id)) mainArticle = null
    if (placement !== 'none') {
      const slot = Number(placement.split('-')[1]) - 1
      const slots: Array<Id | null> = [...secondaryArticles]
      while (slots.length <= slot) slots.push(null)
      slots[slot] = id
      secondaryArticles = slots.filter((x): x is Id => x != null).slice(0, 3)
    }
  }

  return { mode: HeroMode.Manual, mainArticle, secondaryArticles }
}

export async function applyHeroPlacement(
  payload: Payload,
  args: { articleId: Id; placement: HeroPlacement; user: unknown },
): Promise<HeroValue> {
  const settings = (await payload.findGlobal({
    slug: 'site-settings',
    depth: 0,
    overrideAccess: true,
  })) as { homepageHero?: StoredHero }
  const homepageHero = placeInHero(settings.homepageHero ?? {}, args.articleId, args.placement)
  await payload.updateGlobal({
    slug: 'site-settings',
    data: { homepageHero } as never,
    overrideAccess: true,
    user: args.user as never,
  })
  return homepageHero
}
