# Nuxt 3 + Express + Prisma + SQLite 部署 Guideline (Render)

## 架构概览

两个独立 Docker 服务部署到 Render：

| 服务 | 角色 | Plan | 端口 |
|------|------|------|------|
| `{app}-api` | Express + Prisma + SQLite | Starter ($7/月，需要磁盘) | 3001 |
| `{app}-web` | Nuxt 3 SSR | Free / Starter | 3000 |

## 目录结构

```
render.yaml                    # Render Blueprint（一键创建两个服务）
deployment/
├── Dockerfile.server          # API 镜像
├── Dockerfile.web             # 前端镜像
└── deploy.sh                  # (可选) 本地构建验证脚本
```

## 1. Dockerfile.server（API）

```dockerfile
FROM node:20-slim AS builder
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json ./
COPY packages/server/package.json ./packages/server/
RUN pnpm install --frozen-lockfile

COPY packages/server ./packages/server
RUN pnpm --filter server build

FROM node:20-slim
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/server/package.json ./packages/server/
COPY --from=builder /app/packages/server/prisma ./packages/server/prisma
RUN pnpm install --frozen-lockfile --prod
RUN pnpm --filter server exec prisma generate

COPY --from=builder /app/packages/server/dist ./packages/server/dist

ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/prod.db
EXPOSE 3001

CMD ["sh", "-c", "mkdir -p /data/backups && cd packages/server && pnpm exec prisma migrate deploy && node dist/index.js"]
```

**要点：**

- 两阶段构建：builder 全量安装 + 编译，runtime 只装 `--prod` 依赖
- `openssl` 是 Prisma 运行时依赖，两个阶段都要装
- Prisma schema 需要复制到 runtime 阶段执行 `prisma generate`
- 启动时自动 `prisma migrate deploy`，无需手动迁移
- SQLite 文件放在 `/data/`（Render 持久磁盘挂载点）

## 2. Dockerfile.web（前端）

```dockerfile
FROM node:20-slim AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/web/package.json ./packages/web/
RUN pnpm install --frozen-lockfile

COPY packages/web ./packages/web
RUN pnpm --filter web build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/packages/web/.output ./.output

ENV NUXT_PUBLIC_API_BASE=https://{app}-api.onrender.com
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
```

**要点：**

- Nuxt build 产物在 `.output/`，runtime 阶段只需这个目录
- 不需要 pnpm / node_modules，纯 node 运行
- `NUXT_PUBLIC_*` 环境变量在 build 时注入，所以写在 Dockerfile 或 render.yaml 中

## 3. render.yaml（Blueprint）

```yaml
services:
  - type: web
    name: {app}-api
    runtime: docker
    dockerfilePath: ./deployment/Dockerfile.server
    dockerContext: .                          # monorepo 根目录
    region: singapore
    plan: starter
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        value: file:/data/prod.db
      - key: PORT
        value: "3001"
      - key: CORS_ORIGIN
        value: https://{app}-web.onrender.com
      # 敏感变量：sync: false 表示需要在 Dashboard 手动填
      - key: JWT_SECRET
        sync: false
    disk:
      name: data
      mountPath: /data
      sizeGB: 1

  - type: web
    name: {app}-web
    runtime: docker
    dockerfilePath: ./deployment/Dockerfile.web
    dockerContext: .
    region: singapore
    plan: free
    envVars:
      - key: NUXT_PUBLIC_API_BASE
        value: https://{app}-api.onrender.com
```

## 4. 适配新项目 Checklist

1. **全局替换** `{app}` 为你的项目名
2. **调整 `COPY` 路径** — 如果不是 pnpm workspace monorepo（`packages/server`、`packages/web`），改为实际目录
3. **调整环境变量** — 根据项目需要增删 `envVars`（OAuth、邮件等）
4. **敏感密钥** 用 `sync: false`，部署后在 Render Dashboard 填入；生成密钥：`openssl rand -base64 32`
5. **Health check** — 确保 API 有 `/api/health` 端点
6. **CORS_ORIGIN** — 设为前端的 Render URL
7. **如果不需要 SQLite 持久化**（用 PostgreSQL 等），去掉 `disk` 配置，plan 可用 free

## 5. 部署流程

```bash
# 首次：Render Dashboard → New → Blueprint → 选仓库 → 自动识别 render.yaml
# 后续：git push origin main 自动触发
```

## 6. 数据库迁移

```bash
# 本地操作
npx prisma migrate dev --name describe_change
git add prisma/migrations/
git push origin main
# 部署时 CMD 自动执行 prisma migrate deploy
```

## 7. 日常维护

```bash
# 备份数据库（Render Dashboard → {app}-api → Shell）
cp /data/prod.db /data/backups/manual-$(date +%Y%m%d).db

# 查看自动备份
ls -la /data/backups/
```

## 8. 注意事项

- **Starter plan** 才支持持久磁盘（SQLite 必须），$7/月
- **Free plan** 15 分钟无流量休眠，首次请求冷启动慢
- **持久磁盘 = 单实例**，不能水平扩展
- **Region** 选 Singapore 对亚洲用户延迟最低
