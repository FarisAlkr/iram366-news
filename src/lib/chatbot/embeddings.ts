import { getChatbotConfig } from './config'

const MAX_INPUT_CHARS = 8000

/**
 * Embed a single piece of text into a vector. Routes to OpenAI or Voyage
 * depending on EMBEDDINGS_PROVIDER. Both APIs return the same shape:
 * `{ data: [{ embedding: number[] }] }`.
 */
export async function embedText(text: string, kind: 'document' | 'query' = 'document'): Promise<number[]> {
  const cfg = getChatbotConfig()
  if (!cfg.apiKey) {
    throw new Error(`Chatbot embedding key missing (${cfg.provider.toUpperCase()}_API_KEY)`)
  }

  const input = text.slice(0, MAX_INPUT_CHARS)

  if (cfg.provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({ input, model: cfg.model }),
    })
    if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}: ${await res.text()}`)
    const json = (await res.json()) as { data: Array<{ embedding: number[] }> }
    const vec = json.data[0]?.embedding
    if (!vec) throw new Error('OpenAI returned no embedding')
    return vec
  }

  // Voyage AI
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({ input, model: cfg.model, input_type: kind }),
  })
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
