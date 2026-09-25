FROM node:26-alpine AS base


# ========================
# Stage 1
# ========================
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund


# ========================
# Stage 2
# ========================
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Set it when the browser must reach the backend on a different origin
ARG NEXT_PUBLIC_API_HOST=
ENV NEXT_PUBLIC_API_HOST=${NEXT_PUBLIC_API_HOST}

# Turbopack's build cache. Locked as concurrent builds must not share it.
RUN --mount=type=cache,target=/app/.next/cache,sharing=locked npm run build


# ========================
# Stage 3
# ========================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder --chown=node:node /app/public ./public

# Prerender/fetch cache: Next writes under .next/cache at runtime, as uid 1000
RUN mkdir .next && chown node:node .next

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000
CMD ["node", "server.js"]
