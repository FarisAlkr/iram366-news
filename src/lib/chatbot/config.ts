/**
 * Chatbot feature configuration.
 *
 * The whole feature is gated on `NEXT_PUBLIC_CHATBOT_ENABLED=true`. When
 * unset (the default), nothing about the chatbot runs:
 *   • The /api/chat endpoint returns 404
 *   • The afterChange hook on Articles is a no-op
 *   • The <Chatbot /> widget renders nothing
 *
 * To activate, see deploy/CHATBOT-SETUP.md.
 */

export type EmbeddingProvider = 'openai' | 'voyage'

export interface ChatbotConfig {
  enabled: boolean
  provider: EmbeddingProvider
  apiKey: string | undefined
  model: string
  dimensions: number
}

export function isChatbotEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CHATBOT_ENABLED === 'true'
}

export function getChatbotConfig(): ChatbotConfig {
  const provider = (process.env.EMBEDDINGS_PROVIDER === 'voyage'
    ? 'voyage'
    : 'openai') as EmbeddingProvider

  if (provider === 'voyage') {
    return {
      enabled: isChatbotEnabled(),
      provider: 'voyage',
      apiKey: process.env.VOYAGE_API_KEY,
      model: process.env.EMBEDDINGS_MODEL || 'voyage-3',
      dimensions: 1024,
    }
  }

  return {
    enabled: isChatbotEnabled(),
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.EMBEDDINGS_MODEL || 'text-embedding-3-small',
    dimensions: 1536,
  }
}
