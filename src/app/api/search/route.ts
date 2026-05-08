import { NextResponse, type NextRequest } from 'next/server'

import { ArticleStatus } from '@/domain/enums'
import { getPayloadClient } from '@/lib/payload'
import { RateLimits, enforce } from '@/lib/rate-limit'
import { normalizeArabic } from '@/lib/slug'
import type { Article } from '@/types/payload'

const MIN_QUERY_LEN = 2
const MAX_QUERY_LEN = 80
const DEFAULT_LIMIT = 5
const MAX_LIMIT = 20

interface SearchHit {
  title: string
  slug: string
  excerpt: string
}

export async function GET(request: NextRequest) {
  const limited = enforce(request, RateLimits.search)
  if (limited) return limited

  const { searchParams } = request.nextUrl
  const rawQ = (searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY_LEN)
  const limit = Math.min(
    Math.max(parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  )

  if (rawQ.length < MIN_QUERY_LEN) {
    return NextResponse.json({ results: [], totalDocs: 0 })
  }

  // Normalize for tolerant matching (collapses Arabic letter variants);
  // Postgres's `contains` is case-insensitive on TEXT — Arabic-letter
  // variants are not equivalent in the DB, so we send the normalized
  // form as a second OR clause.
  const normalized = normalizeArabic(rawQ)
  const variants = normalized !== rawQ ? [rawQ, normalized] : [rawQ]

  const titleClauses = variants.map((v) => ({ title: { contains: v } }))
  const excerptClauses = variants.map((v) => ({ excerpt: { contains: v } }))

  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'articles',
    where: {
      and: [
        { status: { equals: ArticleStatus.Published } },
        { or: [...titleClauses, ...excerptClauses] },
      ],
    },
    limit,
    sort: '-publishedAt',
    depth: 0,
  })

  const results: SearchHit[] = (result.docs as unknown as Article[]).map((doc) => ({
    title: doc.title,
    slug: doc.slug,
    excerpt: doc.excerpt,
  }))

  return NextResponse.json({ results, totalDocs: result.totalDocs })
}
