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

RUN npm run build

# ---- migrator stage ----------------------------------------------------------
# Slim image carrying the Payload CLI, the schema config, and the migration
# files — nothing else. Built once per deploy and pushed alongside the runner
# image. Used by deploy.yml as a one-shot container to apply pending DB
# migrations before the new app version takes over request serving.
#
# Why this exists separately:
#   * The `runner` stage is the Next.js standalone output — it deliberately
#     omits `node_modules/.bin/payload`, so the CLI is unavailable there.
#   * The `builder` stage has everything, but also a multi-minute `next build`
#     output we don't need for running migrations.
#
# This stage skips `next build` entirely and just ships node_modules + source.
FROM base AS migrator
COPY --from=deps /app/node_modules ./node_modules
# `next-env.d.ts` is intentionally NOT copied here: it's in .gitignore (Next
# regenerates it on every dev/build) and absent from CI's fresh checkout, so
# listing it makes the migrator image build fail in GitHub Actions even
# though it works locally. Payload's CLI doesn't need it.
COPY package.json package-lock.json tsconfig.json next.config.mjs ./
COPY src ./src
ENV NODE_ENV=production
CMD ["npm", "run", "migrate"]

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
