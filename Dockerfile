# syntax=docker/dockerfile:1.7
# ----------------------------------------------------------------------------
# Multi-stage build for IRAM 366 News.
#
#   1. deps    — install production+dev deps for the build
#   2. builder — compile Next.js with output: 'standalone'
#   3. runner  — minimal runtime image: only standalone server + static assets
#
# Result: ~250MB production image instead of ~1GB+, no source code or
# build tooling shipped to the running container.
# ----------------------------------------------------------------------------

ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ---- deps stage --------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ---- builder stage -----------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Next.js inlines NEXT_PUBLIC_* env vars at BUILD time into the client JS
# bundle. They MUST be available here, not just at runtime, otherwise the
# browser ends up with `process.env.NEXT_PUBLIC_SITE_URL` replaced by
# `undefined` and `||`-fallbacks point at localhost — which appears in OG
# images, share URLs, etc., and breaks client-side fetches on mobile.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

ARG NEXT_PUBLIC_CF_ANALYTICS_TOKEN
ENV NEXT_PUBLIC_CF_ANALYTICS_TOKEN=${NEXT_PUBLIC_CF_ANALYTICS_TOKEN}

ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}

ARG NEXT_PUBLIC_USERWAY_ACCOUNT_ID
ENV NEXT_PUBLIC_USERWAY_ACCOUNT_ID=${NEXT_PUBLIC_USERWAY_ACCOUNT_ID}

# Build SHA — the GitHub commit hash that produced this image. Surfaced
# via /api/health for the deploy smoke test to confirm the new image
# actually loaded and is serving traffic. Without this, the smoke test
# only proves "site returns 200" — a failed image pull would still pass
# because the previous image keeps serving.
ARG BUILD_SHA=unknown
ENV BUILD_SHA=${BUILD_SHA}

RUN npm run build

# ---- runner stage ------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

# Run as non-root for defense in depth.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Re-declare BUILD_SHA in the runner stage so the runtime process can
# read it (ENVs from earlier stages don't carry across FROM lines).
ARG BUILD_SHA=unknown
ENV BUILD_SHA=${BUILD_SHA}

# Copy the standalone server (includes a slimmed node_modules) and static
# assets. The `public/` folder is not auto-copied by next.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# Healthcheck the API root — Payload mounts /api/users which 200s when alive.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/users || exit 1

CMD ["node", "server.js"]
