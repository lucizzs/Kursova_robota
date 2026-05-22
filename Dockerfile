# syntax=docker/dockerfile:1.7

# ============================================================
# Stage 1: build — компіляція TypeScript + генерація Prisma client
# ============================================================
FROM node:20-bookworm-slim AS build

WORKDIR /app

# OpenSSL потрібен Prisma (libssl)
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Встановлюємо ВСІ залежності (включно з dev — потрібен tsc, prisma CLI)
COPY package.json package-lock.json* ./
RUN npm ci

# Генеруємо Prisma client (потребує schema.prisma)
COPY prisma ./prisma
RUN npx prisma generate

# Копіюємо джерела і компілюємо
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Видаляємо devDependencies — у наступному стейджі підемо з production-only
RUN npm prune --omit=dev


# ============================================================
# Stage 2: runtime — мінімальний образ для запуску
# ============================================================
FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

# OpenSSL для Prisma runtime
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends openssl ca-certificates wget && \
    rm -rf /var/lib/apt/lists/*

# Створюємо непривілейованого користувача
RUN groupadd --system --gid 1001 nodejs && \
    useradd  --system --uid 1001 --gid nodejs nodeapp

# Копіюємо тільки те, що потрібно для запуску
COPY --from=build --chown=nodeapp:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodeapp:nodejs /app/dist        ./dist
COPY --chown=nodeapp:nodejs public ./public
COPY --from=build --chown=nodeapp:nodejs /app/prisma      ./prisma
COPY --from=build --chown=nodeapp:nodejs /app/package.json ./package.json
COPY --chown=nodeapp:nodejs public ./public

USER nodeapp

EXPOSE 3000

# Healthcheck — Docker буде стукати в /healthz
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --spider --quiet http://localhost:3000/healthz || exit 1

# При старті: накатуємо міграції, потім запускаємо сервер
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/server.js"]
