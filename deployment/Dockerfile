# ── Stage 1: Build ──
FROM node:20-slim AS builder

# better-sqlite3 编译依赖
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Runtime ──
FROM node:20-slim

WORKDIR /app

# node_modules 直接从 builder 复制（同平台，原生模块兼容）
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Nuxt 构建产物
COPY --from=builder /app/.output ./.output

# Drizzle 迁移 SQL + config（启动时执行迁移）
COPY --from=builder /app/server/database/migrations ./server/database/migrations
COPY --from=builder /app/server/database/admin-migrations ./server/database/admin-migrations
COPY --from=builder /app/server/database/schema.ts ./server/database/schema.ts
COPY --from=builder /app/server/database/schemas ./server/database/schemas
COPY --from=builder /app/server/database/admin-schema.ts ./server/database/admin-schema.ts
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/drizzle-admin.config.ts ./drizzle-admin.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# 迁移 + seed 脚本
COPY --from=builder /app/scripts ./scripts

# 启动脚本
COPY deployment/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

ENV NODE_ENV=production
ENV DATA_DIR=/data
EXPOSE 3000

CMD ["./entrypoint.sh"]
