/**
 * Structured JSON logger.
 *
 * Writes a single JSON object per log line to stdout/stderr — friendly to
 * docker logs, fluent-bit, Loki, Datadog, etc. No external dependency.
 *
 * Usage:
 *   import { logger } from '@/lib/logger'
 *   logger.info('article.viewed', { slug, userId })
 *   logger.error('audit.failed', { err: e, collection: 'articles' })
 *
 * In production, set LOG_LEVEL=info (default). In dev, set LOG_LEVEL=debug
 * for noisier output.
 */

type Level = 'debug' | 'info' | 'warn' | 'error'

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }

const envLevel = (process.env.LOG_LEVEL as Level | undefined) ?? 'info'
const threshold = LEVELS[envLevel] ?? LEVELS.info
const service = process.env.LOG_SERVICE ?? 'iram366-news'

type Fields = Record<string, unknown>

function serializeError(err: unknown): Fields | undefined {
  if (!err || typeof err !== 'object') return undefined
  const e = err as Error & { code?: string; cause?: unknown }
  return {
    name: e.name,
    message: e.message,
    code: e.code,
    stack: e.stack,
    cause: e.cause instanceof Error ? { message: e.cause.message, stack: e.cause.stack } : e.cause,
  }
}

function emit(level: Level, event: string, fields?: Fields): void {
  if (LEVELS[level] < threshold) return
  const { err, ...rest } = fields ?? {}
  const line = {
    t: new Date().toISOString(),
    level,
    service,
    event,
    ...rest,
    ...(err !== undefined ? { err: serializeError(err) } : {}),
  }
  const out = JSON.stringify(line)
  if (level === 'error' || level === 'warn') console.error(out)
  else console.log(out)
}

export const logger = {
  debug: (event: string, fields?: Fields) => emit('debug', event, fields),
  info: (event: string, fields?: Fields) => emit('info', event, fields),
  warn: (event: string, fields?: Fields) => emit('warn', event, fields),
  error: (event: string, fields?: Fields) => emit('error', event, fields),
}

export type Logger = typeof logger
