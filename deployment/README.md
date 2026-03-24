# Render 部署指南

## 架构说明

本项目是 Nuxt 3 全栈单体应用（SPA + Nitro API），部署为 **单个 Docker 服务**。

```
┌─────────────────────────────────────────┐
│           Render Web Service            │
│         (Starter plan, $7/月)           │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  node .output/server/index.mjs   │  │
│  │  Nitro = API + SPA 静态文件       │  │
│  └───────────────────────────────────┘  │
│                   │                     │
│  ┌───────────────────────────────────┐  │
│  │  /data (Render Persistent Disk)  │  │
│  │  ├── admin.db                    │  │
│  │  ├── users/{username}.db         │  │
│  │  └── backups/                    │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## 文件清单

| 文件 | 说明 |
|------|------|
| `Dockerfile` | 两阶段构建：builder 编译 → runtime 运行 |
| `entrypoint.sh` | 容器启动脚本：迁移 DB → seed 用户 → 启动 server |
| `render.yaml` | Render Blueprint 配置（一键创建服务） |
| `docker-compose.local.yml` | 本地 Docker 验证（不用于生产） |
| `../.dockerignore` | Docker build context 排除规则（在项目根目录） |

新增的 API 端点：
- `server/api/health.get.ts` — Render health check 使用

## 与 LAN 部署的差异

| | LAN (PM2) | Render (Docker) |
|---|---|---|
| LLM: Claude CLI | 可用 | **不可用**（容器内无认证） |
| LLM: Ollama | 可用 | **不可用**（无本地 GPU） |
| LLM: Claude API | 可用 | 可用 |
| LLM: Gemini | 可用 | 可用 |
| 延迟 | <1ms (局域网) | ~100ms (Singapore) |
| 费用 | 0 | $7/月 (Starter + Disk) |
| 休眠 | 无 | 无 (Starter plan 不休眠) |

## 部署步骤

### 方式 A：Render Blueprint（推荐）

1. 将 `render.yaml` 复制到项目根目录：

   ```bash
   cp deployment/render.yaml ./render.yaml
   ```

2. 推送到 GitHub/GitLab

3. Render Dashboard → **New** → **Blueprint** → 选择仓库 → 自动识别 `render.yaml`

4. 在 Render Dashboard 填写环境变量：

   | 变量 | 值 | 说明 |
   |------|-----|------|
   | `JWT_SECRET` | `openssl rand -base64 32` 生成 | 必填 |
   | `SEED_USERNAME` | 如 `admin` | 首次部署填写 |
   | `SEED_PASSWORD` | 你的密码 | 首次部署填写 |

5. 等待首次部署完成，admin 用户会自动创建

6. **首次部署成功后**，在 Dashboard 删除 `SEED_USERNAME` 和 `SEED_PASSWORD` 避免每次重启重复执行

### 方式 B：手动创建服务

1. Render Dashboard → **New** → **Web Service** → Docker
2. 设置：
   - **Dockerfile Path**: `deployment/Dockerfile`
   - **Docker Context**: `.`（项目根目录）
   - **Plan**: Starter
   - **Region**: Singapore
   - **Health Check**: `/api/health`
3. 添加 Disk：挂载路径 `/data`，大小 1GB
4. 添加环境变量（同上）

## 本地验证

在推送到 Render 前，先用 Docker 在本地测试：

```bash
# 在项目根目录执行
docker compose -f deployment/docker-compose.local.yml up --build

# 等待启动后访问
curl http://localhost:3000/api/health
# 应返回 {"status":"ok","timestamp":...}

# 登录测试（docker-compose 中已设 SEED_USERNAME=admin, SEED_PASSWORD=admin123）
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'

# 清理
docker compose -f deployment/docker-compose.local.yml down -v
```

## 数据库迁移

**开发流程不变：**

```bash
# 1. 修改 schema
# 2. 生成迁移
npm run db:generate
# 3. 提交并推送
git add server/database/migrations/
git push
# 4. Render 自动重新部署，entrypoint.sh 在启动时执行迁移
```

## 备份

Render Persistent Disk 没有自动备份。建议：

```bash
# 在 Render Dashboard → 你的服务 → Shell 中执行
cp /data/admin.db /data/backups/admin-$(date +%Y%m%d).db
for db in /data/users/*.db; do
  cp "$db" "/data/backups/$(basename $db .db)-$(date +%Y%m%d).db"
done
```

或者添加一个 Render Cron Job 定期备份（需要额外配置）。

## 注意事项

- **Starter plan 必须**：SQLite 需要持久磁盘，只有 Starter ($7/月) 以上才支持
- **单实例限制**：持久磁盘 = 不能水平扩展（对个人助手无影响）
- **冷启动**：Starter plan 不休眠，无冷启动问题
- **Image 较大**：因为需要完整 `node_modules`（含 `better-sqlite3` 原生模块 + `drizzle-kit`/`tsx` 迁移工具），预计 ~500MB。可以通过预编译迁移脚本优化，但对个人项目不值得
- **HTTPS**：Render 自动提供 SSL，无需配置
