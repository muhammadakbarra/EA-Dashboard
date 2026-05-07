FROM oven/bun:1.3.11-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install

FROM oven/bun:1.3.11-alpine AS builder
WORKDIR /app

ARG DB_URL
ARG BROKER_BROKEN_API_TOKEN

ENV DB_URL=$DB_URL
ENV BROKER_BROKEN_API_TOKEN=$BROKER_BROKEN_API_TOKEN

# Ambil node_modules dari stage deps, bukan builder (ini yang tadi salah)
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
