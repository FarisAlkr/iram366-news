import { embedText, vectorLiteral } from './embeddings'
import { getChatbotPool } from './db'

export interface ArticleMatch {
  articleId: number
  title: string
  slug: string
  excerpt: string | null
  publishedAt: string | null
  similarity: number
}

/**
 * Embed the user's query, then return the most similar published articles
 * by cosine distance. `<=>` is pgvector's cosine-distance operator; we
 * convert to similarity (1 - distance) for human-friendly ranking.
 */
export async function searchArticles(query: string, limit = 5): Promise<ArticleMatch[]> {
  const queryVec = await embedText(query, 'query')
  const lit = vectorLiteral(queryVec)

  const pool = getChatbotPool()
  const result = await pool.query(
    `
    SELECT
      ae.article_id,
      a.title,
      a.slug,
      a.excerpt,
      a.published_at,
      1 - (ae.embedding <=> $1::vector) AS similarity
    FROM article_embeddings ae
    JOIN articles a ON a.id = ae.article_id
    WHERE
      a.status = 'published'
      AND a.deleted_at IS NULL
      AND (a.published_at IS NULL OR a.published_at <= NOW())
    ORDER BY ae.embedding <=> $1::vector
    LIMIT $2
    `,
    [lit, limit],
  )

  return result.rows.map((row) => ({
    articleId: row.article_id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    publishedAt: row.published_at,
    similarity: parseFloat(row.similarity),
  }))
}
