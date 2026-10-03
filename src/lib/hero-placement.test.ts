import { describe, expect, it } from 'vitest'

import { isHeroPlacement, placeInHero } from './hero-placement'

describe('placeInHero', () => {
  const hero = { mode: 'manual', mainArticle: 1, secondaryArticles: [2, 3, 4] }

  it('sets main and removes the article from the secondary slots', () => {
    expect(placeInHero(hero, 3, 'main')).toEqual({
      mode: 'manual',
      mainArticle: 3,
      secondaryArticles: [2, 4],
    })
  })

  it('replaces the article in a secondary slot and clears it from main', () => {
    expect(placeInHero(hero, 1, 'secondary-2')).toEqual({
      mode: 'manual',
      mainArticle: null,
      secondaryArticles: [2, 1, 4],
    })
  })

  it('compacts into the next free slot when earlier slots are empty', () => {
    expect(placeInHero({ secondaryArticles: [7] }, 9, 'secondary-3')).toMatchObject({
      secondaryArticles: [7, 9],
    })
  })

  it('never keeps more than three secondary articles', () => {
    expect(placeInHero(hero, 9, 'secondary-3').secondaryArticles).toEqual([2, 3, 9])
  })

  it('removes the article everywhere for "none"', () => {
    expect(placeInHero({ mainArticle: 5, secondaryArticles: [5, 6] }, 5, 'none')).toEqual({
      mode: 'manual',
      mainArticle: null,
      secondaryArticles: [6],
    })
  })

  it('accepts populated refs and string ids from request bodies', () => {
    const populated = { mainArticle: { id: 1 }, secondaryArticles: [{ id: 2 }] }
    expect(placeInHero(populated, '2', 'main')).toEqual({
      mode: 'manual',
      mainArticle: 2,
      secondaryArticles: [],
    })
  })
})

describe('isHeroPlacement', () => {
  it('accepts only the five placements', () => {
    expect(isHeroPlacement('secondary-1')).toBe(true)
    expect(isHeroPlacement('secondary-4')).toBe(false)
    expect(isHeroPlacement(1)).toBe(false)
  })
})
