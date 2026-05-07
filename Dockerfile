FROM oven/bun:1.3.11-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install

FROM oven/bun:1.3.11-alpine AS builder
WORKDIR /app

# Tambahkan ARG untuk URL Publik
ARG DB_URL
ARG BROKER_BROKEN_API_TOKEN
ARG NEXT_PUBLIC_BASE_URL

ENV DB_URL=$DB_URL
ENV BROKER_BROKEN_API_TOKEN=$BROKER_BROKEN_API_TOKEN
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public && bun run build

FROM oven/bun:1.3.11-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["bun", "server.js"]
