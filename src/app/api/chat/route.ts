import { NextResponse, type NextRequest } from 'next/server'

import { isChatbotEnabled } from '@/lib/chatbot/config'
import { searchArticles } from '@/lib/chatbot/search'
import { RateLimits, enforce } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const MAX_QUESTION_LEN = 500
const MIN_SIMILARITY = 0.3 // drop weak matches; pgvector cosine 1=perfect, 0=unrelated

/**
 * Public endpoint: visitor asks a question, we return up to 3 article
 * links semantically similar to the question.
 *
 * 404s when the chatbot feature flag is off — defense in depth on top of
 * the widget hiding itself client-side.
 */
export async function POST(req: NextRequest) {
  if (!isChatbotEnabled()) {
    return NextResponse.json({ error: 'chatbot disabled' }, { status: 404 })
  }

  const limited = enforce(req, RateLimits.view)
  if (limited) return limited

  let body: { question?: unknown }
  try {
    body = (await req.json()) as { question?: unknown }
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const question = typeof body.question === 'string' ? body.question.trim() : ''
  if (!question || question.length > MAX_QUESTION_LEN) {
    return NextResponse.json({ error: 'invalid question' }, { status: 400 })
  }

  try {
    const matches = await searchArticles(question, 5)
    const top = matches
      .filter((m) => m.similarity >= MIN_SIMILARITY)
      .slice(0, 3)
      .map((m) => ({
        title: m.title,
        excerpt: m.excerpt,
        url: `/articles/${m.slug}`,
        publishedAt: m.publishedAt,
        score: Math.round(m.similarity * 100),
      }))
    return NextResponse.json({ results: top })
  } catch (err) {
    logger.error('chatbot.search.failed', { err })
    return NextResponse.json({ results: [] }, { status: 200 })
  }
}
