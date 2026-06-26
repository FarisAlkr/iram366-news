import { describe, expect, it, vi } from 'vitest'
import { APIError } from 'payload'

import { cleanupArticleRefsBeforeDelete } from '../article-delete-cleanup.ts'

interface HeroState {
  mainArticle?: number | string | null
  secondaryArticles?: Array<number | string> | null
}

interface MockPayloadOptions {
  reviewCount?: number
  hero?: HeroState
}

function makeReq(opts: MockPayloadOptions = {}) {
  const { reviewCount = 0, hero = {} } = opts
  const payload = {
    count: vi.fn(async () => ({ totalDocs: reviewCount })),
    findGlobal: vi.fn(async () => ({ homepageHero: hero })),
    updateGlobal: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({ docs: [], errors: [] })),
    update: vi.fn(async () => ({ docs: [], errors: [] })),
  }
  return { payload }
}

// The hook only consumes { id, req } off the args object. Cast through
// `unknown` to satisfy Payload's full CollectionBeforeDeleteHook signature
// without stubbing `collection`/`context` we don't read.
function runHook(id: number | string, req: ReturnType<typeof makeReq>) {
  return cleanupArticleRefsBeforeDelete({ id, req } as unknown as Parameters<
    typeof cleanupArticleRefsBeforeDelete
  >[0])
}

describe('cleanupArticleRefsBeforeDelete', () => {
  it('throws an Arabic APIError when editorial reviews exist and stops before any mutation', async () => {
    const req = makeReq({ reviewCount: 3 })

    await expect(runHook(42, req)).rejects.toThrow(APIError)
    await expect(runHook(42, req)).rejects.toThrow(/ملاحظة تحريرية/)

    // Cleanup steps must not have run.
    expect(req.payload.findGlobal).not.toHaveBeenCalled()
    expect(req.payload.updateGlobal).not.toHaveBeenCalled()
    expect(req.payload.delete).not.toHaveBeenCalled()
    expect(req.payload.update).not.toHaveBeenCalled()
  })

  it('clears mainArticle from homepageHero when the deleted article is the hero main', async () => {
    const req = makeReq({
      hero: { mainArticle: 42, secondaryArticles: [10, 20] },
    })

    await runHook(42, req)

    expect(req.payload.updateGlobal).toHaveBeenCalledTimes(1)
    expect(req.payload.updateGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'site-settings',
        overrideAccess: true,
        data: expect.objectContaining({
          homepageHero: expect.objectContaining({
            mainArticle: null,
            secondaryArticles: [10, 20],
          }),
        }),
      }),
    )
  })

  it('filters the deleted article out of homepageHero.secondaryArticles', async () => {
    const req = makeReq({
      hero: { mainArticle: 1, secondaryArticles: [10, 42, 20] },
    })

    await runHook(42, req)

    expect(req.payload.updateGlobal).toHaveBeenCalledTimes(1)
    expect(req.payload.updateGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          homepageHero: expect.objectContaining({
            mainArticle: 1,
            secondaryArticles: [10, 20],
          }),
        }),
      }),
    )
  })

  it('does not touch homepageHero when the article is not referenced there', async () => {
    const req = makeReq({
      hero: { mainArticle: 1, secondaryArticles: [10, 20] },
    })

    await runHook(42, req)

    expect(req.payload.findGlobal).toHaveBeenCalledTimes(1)
    expect(req.payload.updateGlobal).not.toHaveBeenCalled()
  })

  it('bulk-deletes page-views rows scoped to the article', async () => {
    const req = makeReq()

    await runHook(42, req)

    expect(req.payload.delete).toHaveBeenCalledTimes(1)
    expect(req.payload.delete).toHaveBeenCalledWith({
      collection: 'page-views',
      where: { article: { equals: 42 } },
      overrideAccess: true,
    })
  })

  it('NULLs notifications.relatedArticle so the inbox row survives but the FK is dropped', async () => {
    const req = makeReq()

    await runHook(42, req)

    expect(req.payload.update).toHaveBeenCalledTimes(1)
    expect(req.payload.update).toHaveBeenCalledWith({
      collection: 'notifications',
      where: { relatedArticle: { equals: 42 } },
      data: { relatedArticle: null },
      overrideAccess: true,
    })
  })

  it('matches article ids across string/number variants when checking hero slots', async () => {
    // Payload returns relationship IDs as either number or string depending on
    // the underlying adapter. The hook must coerce both sides to string before
    // comparing or it would silently miss clearing the hero slot.
    const req = makeReq({
      hero: { mainArticle: '42', secondaryArticles: ['10', 42] },
    })

    await runHook(42, req)

    expect(req.payload.updateGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          homepageHero: expect.objectContaining({
            mainArticle: null,
            secondaryArticles: ['10'],
          }),
        }),
      }),
    )
  })
})
