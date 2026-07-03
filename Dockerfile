FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# Dependencies
FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production && \
    npx prisma generate

# Build
FROM base AS builder
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc -p tsconfig.json
RUN npx prisma generate

# Production
FROM base AS production
ENV NODE_ENV=production
# Default port — override with PORT env var in Coolify if needed
ENV PORT=3033
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma/
COPY package.json ./

RUN mkdir -p logs

EXPOSE 3033

# Healthcheck uses $PORT so it always matches whatever the app binds to
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3033}/health || exit 1

CMD ["node", "dist/server.js"]
