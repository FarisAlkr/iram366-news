import { getChatbotConfig } from './config'

const MAX_INPUT_CHARS = 8000
const EMBED_TIMEOUT_MS = 30_000

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(new Error(`embedding fetch timeout after ${ms}ms`)), ms)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

/**
 * Embed a single piece of text into a vector. Routes to OpenAI or Voyage
 * depending on EMBEDDINGS_PROVIDER. Both APIs return the same shape:
 * `{ data: [{ embedding: number[] }] }`.
 *
 * Wrapped in a 30s AbortController. Without this, a stalled provider
 * response hangs the calling Payload hook indefinitely, holds its DB
 * connection, and over time exhausts the pool — which is exactly how
 * the May 2026 outage built up.
 */
export async function embedText(
  text: string,
  kind: 'document' | 'query' = 'document',
): Promise<number[]> {
  const cfg = getChatbotConfig()
  if (!cfg.apiKey) {
    throw new Error(`Chatbot embedding key missing (${cfg.provider.toUpperCase()}_API_KEY)`)
  }

  const input = text.slice(0, MAX_INPUT_CHARS)

  if (cfg.provider === 'openai') {
    const res = await fetchWithTimeout(
      'https://api.openai.com/v1/embeddings',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({ input, model: cfg.model }),
      },
      EMBED_TIMEOUT_MS,
    )
    if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}: ${await res.text()}`)
    const json = (await res.json()) as { data: Array<{ embedding: number[] }> }
    const vec = json.data[0]?.embedding
    if (!vec) throw new Error('OpenAI returned no embedding')
    return vec
  }

  // Voyage AI
  const res = await fetchWithTimeout(
    'https://api.voyageai.com/v1/embeddings',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({ input, model: cfg.model, input_type: kind }),
    },
    EMBED_TIMEOUT_MS,
  )
  if (!res.ok) throw new Error(`Voyage embeddings ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> }
  const vec = json.data[0]?.embedding
  if (!vec) throw new Error('Voyage returned no embedding')
  return vec
}

/** Format a vector as a Postgres `vector` literal: `[0.1,0.2,...]` */
export function vectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`
}
